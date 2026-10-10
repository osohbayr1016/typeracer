import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PROMPTS, ROOM_CAPACITY } from '@typeracer/shared';
import { validRoomCode } from './logic';
import { originAllowed } from './origin';
export { RaceRoom } from './room';

type Env = {
  RACE_ROOMS: DurableObjectNamespace;
};
const app = new Hono<{ Bindings: Env }>();
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (!originAllowed(origin, c.req.url)) return c.json({ error: 'Origin not allowed' }, 403);
  await next();
});
app.use('/api/*', (c, next) => {
  // Upgraded WebSocket responses have immutable headers. Never pass them through CORS.
  if (c.req.header('Upgrade')?.toLowerCase() === 'websocket') return next();
  return cors({
    origin: (origin, ctx) => originAllowed(origin, ctx.req.url) ? origin : '',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 3600
  })(c, next);
});
app.use('*', async (c, next) => {
  if (c.req.header('Upgrade')?.toLowerCase() === 'websocket') return next();
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cache-Control', 'no-store');
});
app.get('/api/health', c => c.json({ ok: true, service: 'mongolian-typeracer', version: 1 }));
app.get('/api/prompts', c => {
  const lang = c.req.query('lang') === 'en' ? 'en' : 'mn';
  return c.json({ prompts: PROMPTS[lang] });
});

// Best-effort per-isolate abuse reduction. Deploy Cloudflare WAF rate limiting for global protection.
const roomAttempts = new Map<string, { start: number; count: number }>();
app.post('/api/rooms', async c => {
  const ip = c.req.header('CF-Connecting-IP') || 'anonymous';
  const now = Date.now();
  if (roomAttempts.size > 2000) roomAttempts.clear();
  const entry = roomAttempts.get(ip);
  const next = !entry || now - entry.start > 60_000 ? { start: now, count: 1 } :
    { start: entry.start, count: entry.count + 1 };
  roomAttempts.set(ip, next);
  if (next.count > 10) return c.json({ error: 'Too many rooms; try again later' }, 429);
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const id = c.env.RACE_ROOMS.idFromName(code);
  const created = await c.env.RACE_ROOMS.get(id).fetch('https://room.internal/create', { method: 'POST' });
  if (!created.ok) return c.json({ error: 'Room creation failed' }, 503);
  return c.json({ code, capacity: ROOM_CAPACITY }, 201);
});
app.get('/api/rooms/:code/ws', c => {
  const code = c.req.param('code').toUpperCase();
  if (!validRoomCode(code)) return c.json({ error: 'Invalid room code' }, 400);
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'WebSocket upgrade required' }, 426);
  }
  const id = c.env.RACE_ROOMS.idFromName(code);
  return c.env.RACE_ROOMS.get(id).fetch(c.req.raw);
});
app.notFound(c => c.json({ error: 'Not found' }, 404));
export default app;
