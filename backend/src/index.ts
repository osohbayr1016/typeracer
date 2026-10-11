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
// Guest account is stable per first-party browser. Only DO-written, completed
// races can contribute points; this is a beta, not identity-verified ranking.
const publicRanking = (c: {env:Env;req:{raw:Request}},path:string) => {
  const ns = c.env.RACE_ROOMS;
  return ns.get(ns.idFromName('MONGOLIAN-QUICK-V1')).fetch(
    new Request('https://room.internal'+path,{method:c.req.raw.method,
      headers:c.req.raw.headers,
      body:['GET','HEAD'].includes(c.req.raw.method)?undefined:c.req.raw.body,
      duplex: 'half' } as RequestInit)
  );
};
app.get('/api/account',c=>publicRanking(c,'/account?secure='+(new URL(c.req.url).protocol==='https:'?'1':'0')));
app.post('/api/account/name',c=>publicRanking(c,'/ranking/name'));
app.get('/api/leaderboard',c=>publicRanking(c,'/ranking/players'+new URL(c.req.url).search));
app.get('/api/teams',c=>publicRanking(c,'/ranking/teams'));
app.get('/api/teams/me',c=>publicRanking(c,'/ranking/team'));
app.post('/api/teams',c=>publicRanking(c,'/ranking/team'));
app.get('/api/prompts', c => {
  // Public typing competition is Mongolian-only even if clients request another language.
  return c.json({ prompts: PROMPTS.mn });
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
// One queue coordinator supports multiple simultaneous live matches. Guests and bots
// are identified; no persistent ranked leaderboard or authenticated payout is claimed.
app.get('/api/quickplay/ws', c => {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket')
    return c.json({ error: 'WebSocket upgrade required' }, 426);
  const id = c.env.RACE_ROOMS.idFromName('MONGOLIAN-QUICK-V1');
  const source = new URL(c.req.url);
  return c.env.RACE_ROOMS.get(id).fetch('https://room.internal/quickplay' + source.search,
    { headers: c.req.raw.headers });
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
