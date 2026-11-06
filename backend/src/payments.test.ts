import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { PaymentService, verifyWireSignature } from './payments';
import { RaceRankingStore } from './rankings';

const databases: DatabaseSync[] = [];
const cookie = (token: string) => 'tr_guest=' + token;
async function fixture(configured = true) {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  const sql = { exec(query: string, ...values: Array<string | number | null>) {
    if (/^CREATE /i.test(query.trim())) { db.exec(query); return { toArray: () => [] }; }
    const statement = db.prepare(query);
    if (/^SELECT /i.test(query.trim())) return { toArray: () => statement.all(...values) };
    statement.run(...values); return { toArray: () => [] };
  } } as unknown as SqlStorage;
  const rank = new RaceRankingStore(sql);
  const account = await rank.session(null);
  let state = 'requires_payment_method';
  let amount = 100;
  let currency = 'MNT';
  let orderId = '';
  const upstream = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/payment_intents') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      orderId = body.metadata.order_id;
      return Response.json({ id: 'pi_test123', status: state, amount, currency, metadata: { order_id: orderId } });
    }
    if (path.endsWith('/checkout/sessions')) return Response.json({ url: 'https://pay.wire.mn/c/cs_test123' });
    return Response.json({ id: 'pi_test123', status: state, amount, currency, metadata: { order_id: orderId } });
  });
  const secret = 'whsec_fixture';
  const service = new PaymentService(sql, rank,
    { WIRE_API_KEY: configured ? 'sk_live_fixture' : undefined, WIRE_WEBHOOK_SECRET: secret }, upstream as typeof fetch);
  const request = (path: string, body?: object, token = account.newToken!) => service.fetch(new Request('https://room.internal/payments/' + path, {
    headers: { Cookie: cookie(token), 'X-Payment-Origin': 'https://game.example', 'Content-Type': 'application/json' },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {})
  }));
  return { db, rank, account, upstream, service, request, secret,
    setState: (value: string) => { state = value; db.exec('UPDATE payment_orders SET checked_at=0'); },
    setAmount: (value: number) => { amount = value; }, setCurrency: (value: string) => { currency = value; } };
}
const input = () => ({ packId: 'test-10', requestId: crypto.randomUUID() });
async function signature(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const value = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body));
  return 't=' + timestamp + ',v1=' + [...new Uint8Array(value)].map(v => v.toString(16).padStart(2, '0')).join('');
}
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

describe('Wire checkout and durable paid coins', () => {
  it('reports missing configuration and refuses checkout without making an upstream request', async () => {
    const f = await fixture(false);
    expect(await (await f.request('config')).json()).toMatchObject({ ready: false });
    expect((await f.request('checkout', input())).status).toBe(503);
    expect(f.upstream).not.toHaveBeenCalled();
  });
  it('creates the correct whole-MNT intent and hosted checkout once; retries reuse the order', async () => {
    const f = await fixture(); const body = input();
    const result = await (await f.request('checkout', { ...body, amount: 1, coins: 100000 })).json() as {orderId: string};
    expect(f.upstream).toHaveBeenCalledTimes(2);
    const init = f.upstream.mock.calls[0][1]!;
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 100, currency: 'MNT', metadata: { order_id: result.orderId } });
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toContain(result.orderId);
    expect(JSON.parse(String(f.upstream.mock.calls[1][1]!.body))).toMatchObject({
      success_url: 'https://game.example/coins?order=' + result.orderId,
      cancel_url: 'https://game.example/coins?order=' + result.orderId + '&canceled=1'
    });
    expect(await (await f.request('checkout', body)).json()).toMatchObject({ orderId: result.orderId });
    expect(f.upstream).toHaveBeenCalledTimes(2);
    expect(await (await f.request('wallet')).json()).toMatchObject({ balance: 0 });
  });
  it('recovers from a checkout timeout without creating a second intent', async () => {
    const f = await fixture(); const body = input();
    const implementation = f.upstream.getMockImplementation()!;
    f.upstream.mockImplementationOnce(implementation).mockRejectedValueOnce(new Error('timeout'));
    expect((await f.request('checkout', body)).status).toBe(502);
    expect((await f.request('checkout', body)).status).toBe(200);
    expect(f.upstream.mock.calls.filter(([url]) => String(url).endsWith('/payment_intents'))).toHaveLength(1);
    expect(f.db.prepare('SELECT COUNT(*) AS n FROM payment_orders').get()?.n).toBe(1);
  });
  it('credits only a server-verified succeeded intent, exactly once across repeated polling', async () => {
    const f = await fixture(); const result = await (await f.request('checkout', input())).json() as {orderId: string};
    expect(await (await f.request('orders/' + result.orderId)).json()).toMatchObject({ credited: false, wallet: { balance: 0 } });
    f.setState('succeeded');
    for (let i = 0; i < 3; i++) expect(await (await f.request('orders/' + result.orderId)).json()).toMatchObject({ credited: true, wallet: { balance: 10 } });
    const other = await f.rank.session(null);
    expect((await f.request('orders/' + result.orderId, undefined, other.newToken)).status).toBe(404);
  });
  it('refuses mismatched amount or currency and never credits canceled payments', async () => {
    const f = await fixture(); const result = await (await f.request('checkout', input())).json() as {orderId: string};
    f.setState('succeeded'); f.setAmount(1);
    expect((await f.request('orders/' + result.orderId)).status).toBe(502);
    f.setAmount(100); f.setState('succeeded'); f.setCurrency('USD');
    expect((await f.request('orders/' + result.orderId)).status).toBe(502);
    f.setCurrency('MNT'); f.setState('canceled');
    expect(await (await f.request('orders/' + result.orderId)).json()).toMatchObject({ credited: false, wallet: { balance: 0 } });
  });
  it('recovers a paid order through wallet refresh even if the buyer never returns from checkout', async () => {
    const f = await fixture(); await f.request('checkout', input()); f.setState('succeeded');
    expect(await (await f.request('wallet')).json()).toMatchObject({ balance: 10 });
  });
  it('debits the catalog price once and rejects overspending or foreign-wallet purchases', async () => {
    const f = await fixture(); await f.request('checkout', input()); f.setState('succeeded'); await f.request('wallet');
    f.db.exec('UPDATE payment_orders SET coins=200');
    expect(await (await f.request('items', { itemKey: 'trail:ember', price: 0 })).json()).toMatchObject({ balance: 80, owned: ['trail:ember'] });
    expect(await (await f.request('items', { itemKey: 'trail:ember' })).json()).toMatchObject({ balance: 80 });
    expect((await f.request('items', { itemKey: 'sticker:horse' })).status).toBe(409);
    const other = await f.rank.session(null);
    expect((await f.request('items', { itemKey: 'trail:ember' }, other.newToken)).status).toBe(409);
  });
  it('rejects forged/stale webhook signatures and verifies payment with Wire before crediting', async () => {
    const f = await fixture(); await f.request('checkout', input());
    const body = JSON.stringify({ type: 'payment_intent.succeeded', data: { id: 'pi_test123' } });
    expect(await verifyWireSignature(body, await signature(body, f.secret, 1), f.secret)).toBe(false);
    expect(await verifyWireSignature(body, await signature(body, f.secret), 'https://example.com/webhook')).toBe(false);
    const webhook = (header: string) => f.service.fetch(new Request('https://room.internal/payments/webhook', {
      method: 'POST', headers: { 'WirePayment-Signature': header }, body
    }));
    expect((await webhook('t=0,v1=bad')).status).toBe(400);
    expect((await webhook(await signature(body, f.secret))).status).toBe(200);
    expect(f.service.wallet(String(f.account.player.id)).balance).toBe(0);
    f.setState('succeeded');
    expect((await webhook(await signature(body, f.secret))).status).toBe(200);
    expect(f.service.wallet(String(f.account.player.id)).balance).toBe(10);
  });
});
