import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { COIN_PACKS } from '@typeracer/shared';
import { PaymentService, verifyWireSignature } from './payments';
import { RaceRankingStore } from './rankings';
import { EarnedProgressionStore } from './earned';

const databases: DatabaseSync[] = [];
const cookie = (token: string) => 'tr_guest=' + token;
async function fixture(configured = true, useRuntimeFetch = false) {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  const sql = { exec(query: string, ...values: Array<string | number | null>) {
    if (/^CREATE /i.test(query.trim())) { db.exec(query); return { toArray: () => [] }; }
    const statement = db.prepare(query);
    if (/^(SELECT |PRAGMA )/i.test(query.trim())) return { toArray: () => statement.all(...values) };
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
  if (useRuntimeFetch) vi.stubGlobal('fetch', function(this: unknown, url: RequestInfo | URL, init?: RequestInit) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    return upstream(url, init);
  });
  const secret = 'whsec_fixture';
  const service = new PaymentService(sql, rank,
    { WIRE_API_KEY: configured ? 'sk_live_fixture' : undefined, WIRE_WEBHOOK_SECRET: secret }, useRuntimeFetch ? undefined : upstream as typeof fetch);
  const request = (path: string, body?: object, token = account.newToken!) => service.fetch(new Request('https://room.internal/payments/' + path, {
    headers: { Cookie: cookie(token), 'X-Payment-Origin': 'https://game.example', 'Content-Type': 'application/json' },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {})
  }));
  return { db, sql, rank, account, upstream, service, request, secret,
    setState: (value: string) => { state = value; db.exec('UPDATE payment_orders SET checked_at=0'); },
    setAmount: (value: number) => { amount = value; }, setCurrency: (value: string) => { currency = value; } };
}
const input = () => ({ packId: 'test-10', requestId: crypto.randomUUID() });
async function signature(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const value = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body));
  return 't=' + timestamp + ',v1=' + [...new Uint8Array(value)].map(v => v.toString(16).padStart(2, '0')).join('');
}
afterEach(() => { vi.unstubAllGlobals(); for (const db of databases.splice(0)) db.close(); });

describe('Wire checkout and durable paid coins', () => {
  it('prevents cross-ledger purchases of an item already earned or bought', async () => {
    const f=await fixture();
    const playerId=String(f.account.player.id);
    const earned=new EarnedProgressionStore(f.sql);
    expect(earned.buy(playerId,'title','swift')).toHaveProperty('profile');
    await f.request('checkout',input());
    f.setState('succeeded');
    await f.request('wallet');
    f.db.exec('UPDATE payment_orders SET coins=500');
    const initialPaid=f.service.wallet(playerId).balance;
    const rejected=await f.request('items',{itemKey:'title:swift'});
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toMatchObject({error:'already_owned'});
    expect(f.service.wallet(playerId).balance).toBe(initialPaid);
    expect(f.db.prepare('SELECT COUNT(*) n FROM payment_items').get()?.n).toBe(0);
    // The inverse direction also rejects a second debit from earned coins.
    expect((await f.request('items',{itemKey:'trail:ember'})).status).toBe(200);
    const initialEarned=earned.overview(playerId).coins;
    expect(earned.buy(playerId,'trail','ember')).toEqual({error:'already_owned'});
    expect(earned.overview(playerId).coins).toBe(initialEarned);
  });

  it('uses a global fetch receiver compatible with the Workers runtime', async () => {
    const f = await fixture(true, true);
    expect((await f.request('checkout', input())).status).toBe(200);
    expect(f.upstream).toHaveBeenCalledTimes(2);
  });
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
  it('cannot bypass earned XP level gates by purchasing a locked car with paid coins', async () => {
    const f = await fixture();
    await f.request('checkout', input());
    f.setState('succeeded');
    await f.request('wallet');
    f.db.exec('UPDATE payment_orders SET coins=10000');
    const playerId = String(f.account.player.id);
    const first = await f.request('items', { itemKey: 'car:dragon' });
    expect(first.status).toBe(403);
    expect(await first.json()).toMatchObject({ error: 'level_required' });
    expect(f.service.wallet(playerId)).toMatchObject({ balance: 10000, owned: [] });
    // Real online progress uses earned_profiles; editable client level is ignored.
    new EarnedProgressionStore(f.sql);
    f.db.prepare('INSERT INTO earned_profiles(player_id,xp) VALUES(?,?)').run(playerId, 10200);
    const unlocked = await f.request('items', { itemKey: 'car:dragon' });
    expect(unlocked.status).toBe(200);
    expect(await unlocked.json()).toMatchObject({ balance: 5000, owned: ['car:dragon'] });
    expect((await f.request('items', { itemKey: 'car:dragon' })).status).toBe(200);
    expect(f.service.wallet(playerId).balance).toBe(5000);
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
  it('requires durable account protection for normal packs and uses server prices',async()=>{
    const f=await fixture();const body={packId:'coins-200',requestId:crypto.randomUUID(),amount:1,coins:999999};
    expect((await f.request('checkout',body)).status).toBe(403);expect(f.upstream).not.toHaveBeenCalled();
    await f.rank.createRecovery(cookie(f.account.newToken!));
    expect((await f.request('checkout',body)).status).toBe(200);
    expect(JSON.parse(String(f.upstream.mock.calls[0][1]!.body))).toMatchObject({amount:1000});
    expect(f.db.prepare('SELECT coins,amount FROM payment_orders').get()).toMatchObject({coins:200,amount:1000});
  });
  it('grants a one-time supporter bundle exactly once and reuses an open checkout across tabs',async()=>{
    const f=await fixture();await f.rank.createRecovery(cookie(f.account.newToken!));f.setAmount(9900);
    const first=await (await f.request('checkout',{packId:'supporter',requestId:crypto.randomUUID()})).json() as {orderId:string};
    const duplicate=await (await f.request('checkout',{packId:'supporter',requestId:crypto.randomUUID()})).json() as {orderId:string};
    expect(duplicate.orderId).toBe(first.orderId);
    expect(f.upstream.mock.calls.filter(([url,init])=>String(url).endsWith('/payment_intents')&&init?.method==='POST')).toHaveLength(1);
    f.setState('succeeded');
    const wallet=await (await f.request('wallet')).json();
    expect(wallet).toMatchObject({balance:2000,supporter:true,owned:['trail:gold','sticker:crown','title:supporter']});
    expect((await f.request('checkout',{packId:'supporter',requestId:crypto.randomUUID()})).status).toBe(409);
    expect(await (await f.request('orders/'+first.orderId)).json()).toMatchObject({credited:true,grants:['trail:gold','sticker:crown','title:supporter']});
  });
  it('keeps the original pending quote when the catalog price changes',async()=>{
    const f=await fixture();const body=input();f.upstream.mockRejectedValueOnce(new Error('timeout'));
    expect((await f.request('checkout',body)).status).toBe(502);
    const pack=COIN_PACKS.find(p=>p.id==='test-10')!;const original=pack.amount;
    try{pack.amount=200;expect((await f.request('checkout',body)).status).toBe(200);
      expect(JSON.parse(String(f.upstream.mock.calls[1][1]!.body))).toMatchObject({amount:100});
    }finally{pack.amount=original;}
  });
  it('stores only a hash of the recovery code and restores paid inventory after session loss',async()=>{
    const f=await fixture();const saved=await f.rank.createRecovery(cookie(f.account.newToken!));
    expect(saved?.code).toMatch(/^trr_[a-f0-9]{48}$/);
    expect((await f.rank.createRecovery(cookie(f.account.newToken!)))?.exists).toBe(true);
    expect(JSON.stringify(f.db.prepare('SELECT * FROM leaderboard_recovery').all())).not.toContain(saved!.code!);
    await f.request('checkout',input());f.setState('succeeded');await f.request('wallet');
    await f.rank.logout(cookie(f.account.newToken!));
    const restored=await f.rank.restoreRecovery(saved!.code!);
    expect(restored?.player.id).toBe(f.account.player.id);
    expect(await (await f.request('wallet',undefined,restored!.newToken)).json()).toMatchObject({balance:10});
    expect(await f.rank.restoreRecovery('trr_'+'0'.repeat(48))).toBeNull();
  });
  it('merges guest purchases and the recovery code into an existing OAuth account',async()=>{
    const f=await fixture();const target=await f.rank.session(null);const state1=crypto.randomUUID();
    await f.rank.startOAuth(cookie(target.newToken!),'google',state1);
    const login=await f.rank.completeOAuth(cookie(target.newToken!),'google',state1,'google-same-owner','Owner');
    const saved=await f.rank.createRecovery(cookie(f.account.newToken!));
    await f.request('checkout',input());f.setState('succeeded');await f.request('wallet');
    const state2=crypto.randomUUID();await f.rank.startOAuth(cookie(f.account.newToken!),'google',state2);
    const merged=await f.rank.completeOAuth(cookie(f.account.newToken!),'google',state2,'google-same-owner','Owner');
    f.service.mergeAccount(merged!.previousPlayerId,String(merged!.player.id));
    expect(merged!.player.id).toBe(login!.player.id);
    expect(await (await f.request('wallet',undefined,merged!.newToken)).json()).toMatchObject({balance:10});
    expect((await f.rank.restoreRecovery(saved!.code!))?.player.id).toBe(login!.player.id);
    expect(f.service.wallet(String(f.account.player.id)).balance).toBe(0);
  });

  it('retains both receipts when merged accounts used the same browser retry key',async()=>{
    const f=await fixture();const request=input();await f.request('checkout',request);f.setState('succeeded');await f.request('wallet');
    const target=await f.rank.session(null);
    f.db.prepare('INSERT INTO payment_orders(id,player_id,request_id,pack_id,amount,coins,status,credited,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run('older-target-order',String(target.player.id),request.requestId,'test-10',100,10,'succeeded',1,Date.now());
    f.service.mergeAccount(String(f.account.player.id),String(target.player.id));
    expect(f.service.wallet(String(target.player.id)).balance).toBe(20);
    expect(f.db.prepare('SELECT COUNT(*) AS n FROM payment_orders WHERE player_id=?').get(String(target.player.id))?.n).toBe(2);
  });

});
