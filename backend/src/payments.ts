import { COIN_PACKS, SHOP } from '@typeracer/shared';
import { RaceRankingStore } from './rankings';

export type PaymentEnv = { WIRE_API_KEY?: string; WIRE_WEBHOOK_SECRET?: string };
type Row = Record<string, unknown>;
type Intent = { id: string; status: string; amount: number; currency: string;
  expires_at?: number; metadata?: Record<string, string> };
const first = (cursor: { toArray(): Row[] }) => cursor.toArray()[0] as Row | undefined;
class PaymentError extends Error {
  constructor(readonly code: string, readonly status = 502) { super(code); }
}
export function checkoutUrl(value: unknown): string {
  if (typeof value !== 'string') throw new PaymentError('invalid_checkout');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'pay.wire.mn' || url.username || url.password)
    throw new PaymentError('invalid_checkout');
  return url.href;
}
export async function verifyWireSignature(body: string, header: string, secret: string, now = Date.now()) {
  if (!secret.startsWith('whsec_')) return false;
  const parts = header.split(',').map(part => part.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1] ?? '';
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const signatures = parts.filter(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  for (const [, hex] of signatures) {
    const bytes = new Uint8Array(hex.match(/../g)!.map(byte => parseInt(byte, 16)));
    if (await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(timestamp + '.' + body))) return true;
  }
  return false;
}

/** Uses the existing SQLite coordinator; no D1 binding or destructive migration. */
export class PaymentService {
  // Workerd brand-checks fetch receivers; an arrow keeps the global call unbound.
  constructor(private sql: SqlStorage, private rank: RaceRankingStore, private env: PaymentEnv,
    private upstream: typeof fetch = (input, init) => fetch(input, init)) {
    sql.exec(`CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY, player_id TEXT NOT NULL, request_id TEXT NOT NULL,
      pack_id TEXT NOT NULL, amount INTEGER NOT NULL, coins INTEGER NOT NULL,
      intent_id TEXT UNIQUE, checkout_url TEXT, status TEXT NOT NULL DEFAULT 'creating',
      credited INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
      checked_at INTEGER NOT NULL DEFAULT 0, UNIQUE(player_id,request_id))`);
    sql.exec(`CREATE INDEX IF NOT EXISTS payment_orders_player ON payment_orders(player_id,created_at)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS payment_items (
      player_id TEXT NOT NULL, item_key TEXT NOT NULL, price INTEGER NOT NULL,
      created_at INTEGER NOT NULL, PRIMARY KEY(player_id,item_key))`);
  }
  private ready() { return !!this.env.WIRE_API_KEY?.startsWith('sk_live_'); }
  private async wire(path: string, key?: string, body?: object) {
    const response = await this.upstream('https://api.wire.mn/v1' + path, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: 'Bearer ' + this.env.WIRE_API_KEY, 'Content-Type': 'application/json',
        ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let value: Record<string, unknown>;
    try { value = await response.json() as Record<string, unknown>; }
    catch { throw new PaymentError('wire_invalid_response'); }
    if (!response.ok) {
      const code = (value.error as {code?: string} | undefined)?.code;
      console.warn('Wire request rejected', { path, status: response.status,
        code: typeof code === 'string' && /^[a-z_]+$/.test(code) ? code : 'unknown' });
      if (response.status === 401) throw new PaymentError('wire_authentication_failed');
      const allowed = ['connector_required', 'settlement_account_required', 'operator_unavailable',
        'operator_not_allowed', 'test_mode_unavailable', 'rate_limit_exceeded'];
      throw new PaymentError(code && allowed.includes(code) ? code : 'wire_unavailable');
    }
    return value;
  }
  wallet(playerId: string) {
    const credit = Number(first(this.sql.exec(
      'SELECT COALESCE(SUM(coins),0) AS total FROM payment_orders WHERE player_id=? AND credited=1', playerId))?.total ?? 0);
    const spent = Number(first(this.sql.exec(
      'SELECT COALESCE(SUM(price),0) AS total FROM payment_items WHERE player_id=?', playerId))?.total ?? 0);
    return { balance: credit - spent,
      owned: this.sql.exec('SELECT item_key FROM payment_items WHERE player_id=?', playerId).toArray().map(row => String(row.item_key)),
      recent: this.sql.exec('SELECT id,coins,amount,status,credited FROM payment_orders WHERE player_id=? ORDER BY created_at DESC LIMIT 10', playerId)
        .toArray().map(row => ({ ...row, credited: row.credited === 1 })) };
  }
  private async reconcile(order: Row, force = false) {
    if (!order.intent_id || order.credited === 1 || order.status === 'canceled') return order;
    if (!force && Date.now() - Number(order.checked_at) < 10_000) return order;
    // Bound API polling even if concurrent tabs/checks arrive while fetch awaits.
    this.sql.exec('UPDATE payment_orders SET checked_at=? WHERE id=?', Date.now(), order.id);
    const intent = await this.wire('/payment_intents/' + encodeURIComponent(String(order.intent_id))) as unknown as Intent;
    if (intent.id !== order.intent_id || intent.amount !== order.amount || intent.currency !== 'MNT' ||
        intent.metadata?.order_id !== order.id) throw new PaymentError('payment_mismatch');
    // A single durable SQL update is the credit ledger. Replays cannot add a second credit.
    this.sql.exec('UPDATE payment_orders SET status=?,credited=CASE WHEN ?=\'succeeded\' THEN 1 ELSE credited END WHERE id=?',
      intent.status, intent.status, order.id);
    return first(this.sql.exec('SELECT * FROM payment_orders WHERE id=?', order.id))!;
  }
  private async create(playerId: string, input: Record<string, unknown>, origin: string) {
    const pack = COIN_PACKS.find(pack => pack.id === input.packId);
    if (!pack || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId))
      throw new PaymentError('invalid_request', 400);
    let order = first(this.sql.exec('SELECT * FROM payment_orders WHERE player_id=? AND request_id=?', playerId, input.requestId));
    if (order && order.pack_id !== pack.id) throw new PaymentError('invalid_request', 409);
    if (!order) {
      const recent = Number(first(this.sql.exec('SELECT COUNT(*) AS n FROM payment_orders WHERE player_id=? AND created_at>?',
        playerId, Date.now() - 60_000))?.n ?? 0);
      if (recent >= 3) throw new PaymentError('rate_limit_exceeded', 429);
      this.sql.exec('INSERT INTO payment_orders(id,player_id,request_id,pack_id,amount,coins,created_at) VALUES(?,?,?,?,?,?,?)',
        crypto.randomUUID(), playerId, input.requestId, pack.id, pack.amount, pack.coins, Date.now());
      order = first(this.sql.exec('SELECT * FROM payment_orders WHERE player_id=? AND request_id=?', playerId, input.requestId))!;
    }
    if (order.credited === 1) return { orderId: order.id, paid: true };
    if (order.checkout_url) return { orderId: order.id, url: checkoutUrl(order.checkout_url) };
    if (!order.intent_id) {
      const intent = await this.wire('/payment_intents', 'tr-' + order.id + '-intent', {
        amount: pack.amount, currency: 'MNT', description: 'TypeRacer · ' + pack.coins + ' coins',
        metadata: { order_id: String(order.id) }
      });
      if (typeof intent.id !== 'string' || !/^pi_[a-zA-Z0-9]+$/.test(intent.id)) throw new PaymentError('wire_unavailable');
      this.sql.exec('UPDATE payment_orders SET intent_id=?,status=? WHERE id=?', intent.id, String(intent.status), order.id);
      order.intent_id = intent.id;
    }
    const returnUrl = new URL('/coins', origin);
    returnUrl.searchParams.set('order', String(order.id));
    const cancelUrl = new URL(returnUrl); cancelUrl.searchParams.set('canceled', '1');
    const checkout = await this.wire('/checkout/sessions', 'tr-' + order.id + '-checkout', {
      payment_intent: order.intent_id, success_url: returnUrl.href, cancel_url: cancelUrl.href
    });
    const url = checkoutUrl(checkout.url);
    this.sql.exec('UPDATE payment_orders SET checkout_url=? WHERE id=?', url, order.id);
    return { orderId: order.id, url };
  }
  async fetch(request: Request) {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/payments/config') return Response.json({ ready: this.ready(), packs: COIN_PACKS });
      if (path === '/payments/webhook') {
        const body = await request.text();
        if (body.length > 65_536 || !await verifyWireSignature(body, request.headers.get('WirePayment-Signature') ?? '',
          this.env.WIRE_WEBHOOK_SECRET ?? '')) return Response.json({ error: 'invalid_signature' }, { status: 400 });
        const event = JSON.parse(body) as {type?: string; data?: {id?: string}};
        if (event.type === 'payment_intent.succeeded' && event.data?.id) {
          const order = first(this.sql.exec('SELECT * FROM payment_orders WHERE intent_id=?', event.data.id));
          if (order) await this.reconcile(order, true);
        }
        return Response.json({ received: true });
      }
      const player = await this.rank.fromCookie(request.headers.get('Cookie'));
      if (!player) return Response.json({ error: 'session_required' }, { status: 401 });
      const playerId = String(player.id);
      if (path === '/payments/wallet') {
        if (this.ready()) {
          const pending = this.sql.exec("SELECT * FROM payment_orders WHERE player_id=? AND credited=0 AND intent_id IS NOT NULL AND status!='canceled' ORDER BY created_at DESC LIMIT 5", playerId).toArray();
          await Promise.all(pending.map(order => this.reconcile(order).catch(() => null)));
        }
        return Response.json(this.wallet(playerId));
      }
      if (path.startsWith('/payments/orders/')) {
        const id = path.slice('/payments/orders/'.length);
        const order = first(this.sql.exec('SELECT * FROM payment_orders WHERE id=? AND player_id=?', id, playerId));
        if (!order) return Response.json({ error: 'order_not_found' }, { status: 404 });
        const current = await this.reconcile(order);
        return Response.json({ orderId: id, status: current.status, credited: current.credited === 1,
          amount: current.amount, coins: current.coins, wallet: this.wallet(playerId) });
      }
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      const raw = await request.text();
      if (raw.length > 2048) return new Response(null, { status: 413 });
      let input: Record<string, unknown>;
      try { input = JSON.parse(raw); if (!input || typeof input !== 'object') throw Error(); }
      catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
      if (path === '/payments/checkout') {
        if (!this.ready()) throw new PaymentError('payments_not_configured', 503);
        const origin = request.headers.get('X-Payment-Origin');
        if (!origin || !/^https?:\/\//.test(origin)) throw new PaymentError('invalid_origin', 400);
        return Response.json(await this.create(playerId, input, origin));
      }
      if (path === '/payments/items') {
        const item = SHOP.find(item => item.kind + ':' + item.id === input.itemKey);
        if (!item) throw new PaymentError('invalid_request', 400);
        const key = item.kind + ':' + item.id;
        if (!first(this.sql.exec('SELECT item_key FROM payment_items WHERE player_id=? AND item_key=?', playerId, key))) {
          if (this.wallet(playerId).balance < item.price) throw new PaymentError('insufficient_coins', 409);
          // No await between checking the balance and inserting the debit: serialized in this DO.
          this.sql.exec('INSERT INTO payment_items(player_id,item_key,price,created_at) VALUES(?,?,?,?)', playerId, key, item.price, Date.now());
        }
        return Response.json(this.wallet(playerId));
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    } catch (error) {
      console.warn('Payment request failed', { path: new URL(request.url).pathname,
        code: error instanceof PaymentError ? error.code : 'payment_unavailable',
        name: error instanceof Error ? error.name : 'Unknown' });
      return Response.json({ error: error instanceof PaymentError ? error.code : 'payment_unavailable' },
        { status: error instanceof PaymentError ? error.status : 502 });
    }
  }
}
