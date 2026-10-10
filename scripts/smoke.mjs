import assert from 'node:assert/strict';

const baseString = process.argv[2];
if (!baseString) {
  console.error('Usage: node scripts/smoke.mjs https://YOUR-WORKER.workers.dev');
  process.exit(2);
}
const origin = new URL(baseString).origin;
if (new URL(origin).protocol !== 'https:') throw new Error('Staging smoke test requires HTTPS.');

async function request(path, init) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(origin + path, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: { ...(init?.headers || {}), 'Cache-Control': 'no-cache' }
      });
      if (response.ok) return response;
      lastError = new Error(path + ' returned HTTP ' + response.status + ': ' + (await response.text()).slice(0, 200));
    } catch (error) { lastError = error; }
    if (attempt < 5) await new Promise(r => setTimeout(r, 1_500 * (attempt + 1)));
  }
  throw lastError;
}
const home = await request('/');
assert.match(home.headers.get('content-type') || '', /text\/html/i);
const html = await home.text();
assert.match(html, /<html|<!doctype html/i);
console.log('✓ Static website serves HTML:', origin);

const health = await (await request('/api/health')).json();
assert.equal(health.ok, true);
console.log('✓ Backend health:', health.service);

const prompts = await (await request('/api/prompts?lang=mn')).json();
assert(Array.isArray(prompts.prompts) && prompts.prompts.length > 0);
console.log('✓ Mongolian prompts API');

const room = await (await request('/api/rooms', { method: 'POST' })).json();
assert.match(room.code, /^[A-F0-9]{8}$/);
console.log('✓ Durable Object room creation:', room.code);

if (!globalThis.WebSocket) throw new Error('Node 22+ global WebSocket API is required.');
const wsUrl = origin.replace(/^https:/, 'wss:') + '/api/rooms/' + room.code + '/ws?name=Smoke';
await new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl);
  let receivedSnapshot = false;
  const timeout = setTimeout(() => { socket.close(); reject(new Error('WebSocket snapshot timeout')); }, 15_000);
  socket.addEventListener('message', event => {
    try {
      const value = JSON.parse(event.data);
      if (value.type === 'state') {
        receivedSnapshot = true;
        assert.equal(value.phase, 'waiting');
        assert(value.players.length >= 1);
        clearTimeout(timeout);
        socket.close();
        resolve();
      }
    } catch (error) { clearTimeout(timeout); socket.close(); reject(error); }
  });
  socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket connection failed')); });
  socket.addEventListener('close', () => {
    // A socket that closes before the first room snapshot is a failed smoke test.
    // Closing after receiving the snapshot is handled by resolve() above.
    if (!receivedSnapshot) { clearTimeout(timeout); reject(new Error('WebSocket closed before room snapshot')); }
  });
});
console.log('✓ Live WebSocket room state');
console.log('STAGING SMOKE TEST PASSED:', origin);
