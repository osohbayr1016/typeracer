import assert from 'node:assert/strict';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/smoke.mjs https://YOUR-WORKER.workers.dev');
  process.exit(2);
}
const url = new URL(input);
if (url.protocol !== 'https:') throw new Error('Smoke test requires an HTTPS deployment URL.');
const origin = url.origin;

async function fetchHealthy(path, init) {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(origin + path, {
        ...init,
        signal: AbortSignal.timeout(12000),
        headers: { 'Cache-Control': 'no-cache', ...(init?.headers || {}) }
      });
      if (response.ok) return response;
      lastError = new Error(path + ' returned HTTP ' + response.status + ': ' + (await response.text()).slice(0, 150));
    } catch (error) {
      lastError = error;
    }
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
  }
  throw lastError;
}

const response = await fetchHealthy('/');
assert.match(response.headers.get('content-type') || '', /text\/html/i);
assert.match(await response.text(), /<html|<!doctype html/i);
console.log('✓ Website HTML:', origin);

const health = await (await fetchHealthy('/api/health')).json();
assert.equal(health.ok, true);
console.log('✓ API health');

const prompts = await (await fetchHealthy('/api/prompts?lang=mn')).json();
assert(Array.isArray(prompts.prompts) && prompts.prompts.length > 0);
console.log('✓ Mongolian prompts');

const created = await (await fetchHealthy('/api/rooms', { method: 'POST' })).json();
assert.match(created.code, /^[A-F0-9]{8}$/);
console.log('✓ Durable Object room:', created.code);

if (typeof globalThis.WebSocket !== 'function') throw new Error('Node.js 22+ with WebSocket is required.');
const socketUrl = origin.replace(/^https:/, 'wss:') + '/api/rooms/' + created.code + '/ws?name=';
const latestStates = new Map();
const sockets = [];
function join(name) {
  const socket = new WebSocket(socketUrl + encodeURIComponent(name));
  sockets.push(socket);
  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'state') latestStates.set(socket, message);
    } catch { /* Ignore non-state messages. */ }
  });
  return socket;
}
function waitFor(socket, predicate, description, durationMs = 15000) {
  const previous = latestStates.get(socket);
  if (previous && predicate(previous)) return Promise.resolve(previous);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => fail(new Error('Timeout: ' + description)), durationMs);
    function cleanup() {
      clearTimeout(timeout);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('error', onError);
    }
    function fail(error) { cleanup(); reject(error); }
    function onClose() { fail(new Error('WebSocket closed before ' + description)); }
    function onError() { fail(new Error('WebSocket failed before ' + description)); }
    function onMessage() {
      const state = latestStates.get(socket);
      if (state && predicate(state)) { cleanup(); resolve(state); }
    }
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);
  });
}

try {
  const alice = join('SmokeAlice');
  const bob = join('SmokeBob');
  const [aLobby, bLobby] = await Promise.all([
    waitFor(alice, state => state.players.length === 2, 'Alice two-player lobby'),
    waitFor(bob, state => state.players.length === 2, 'Bob two-player lobby')
  ]);
  assert.equal(aLobby.prompt.text, bLobby.prompt.text);
  console.log('✓ Two real WebSocket clients synchronized');

  alice.send(JSON.stringify({ type: 'ready' }));
  bob.send(JSON.stringify({ type: 'ready' }));
  const [aRace, bRace] = await Promise.all([
    waitFor(alice, state => state.phase === 'racing', 'Alice countdown', 15000),
    waitFor(bob, state => state.phase === 'racing', 'Bob countdown', 15000)
  ]);
  assert.equal(aRace.startAt, bRace.startAt);
  console.log('✓ Live countdown and race start');

  const keys = [...aRace.prompt.text].slice(0, 5);
  assert.equal(keys.length, 5);
  for (const key of keys) alice.send(JSON.stringify({ type: 'key', key }));
  const seenByBob = await waitFor(
    bob,
    state => (state.players.find(player => player.name === 'SmokeAlice')?.progress || 0) >= keys.length,
    'Bob receiving Alice keystrokes',
    10000
  );
  assert.equal(seenByBob.players.find(player => player.name === 'SmokeAlice').progress, keys.length);
  console.log('✓ Server checked characters and broadcast progress to opponent');
  console.log('LIVE STAGING SMOKE TEST PASSED:', origin);
} finally {
  for (const socket of sockets) {
    try { socket.close(); } catch { /* Already closed. */ }
  }
}
