import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickMatchmaker, QUICK_RECONNECT_GRACE_MS } from './quick';

type EventName = 'message' | 'close' | 'error';
class FakeSocket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  private listeners: Partial<Record<EventName, Array<(event: {data?: string}) => void>>> = {};
  accept() {}
  send(value: string) { if (this.readyState !== 1) throw new Error('closed'); this.sent.push(JSON.parse(value)); }
  addEventListener(name: EventName, handler: (event: {data?: string}) => void) {
    (this.listeners[name] ||= []).push(handler);
  }
  receive(value: object) {
    for (const fn of this.listeners.message || []) fn({data: JSON.stringify(value)});
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    for (const fn of this.listeners.close || []) fn({});
  }
}
const pairs: Array<{client: FakeSocket; server: FakeSocket}> = [];
class FakePair {
  0: FakeSocket;
  1: FakeSocket;
  constructor() {
    this[0] = new FakeSocket();
    this[1] = new FakeSocket();
    pairs.push({client: this[0], server: this[1]});
  }
}
class FakeResponse {
  status: number;
  constructor(_body: unknown, options: {status: number}) { this.status = options.status; }
}
async function connect(matchmaker: QuickMatchmaker, token?: string) {
  const suffix = token ? '?resume=' + encodeURIComponent(token) : '';
  const response = await matchmaker.fetch(new Request('https://room.internal/quickplay' + suffix, {
    headers: { Upgrade: 'websocket' }
  }));
  expect(response.status).toBe(101);
  const socket = pairs[pairs.length - 1].server;
  const welcome = socket.sent.find(message => message.type === 'welcome')!;
  const snapshot = socket.sent.find(message => message.type === 'state')!;
  return {socket, welcome, snapshot};
}

beforeEach(() => {
  pairs.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
  vi.stubGlobal('WebSocketPair', FakePair);
  vi.stubGlobal('WebSocket', {OPEN: 1});
  // Native Node Response refuses the Workers-only 101 WebSocket upgrade status.
  vi.stubGlobal('Response', FakeResponse);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Durable Object live quick race reconnect', () => {
  it('preserves racer ID, match ID, Mongolian progress and cosmetics across a reconnect', async () => {
    const doMatch = new QuickMatchmaker();
    const first = await connect(doMatch);
    expect(first.welcome.resumed).toBe(false);
    expect(typeof first.welcome.resumeToken).toBe('string');
    expect(JSON.stringify(first.snapshot)).not.toContain(String(first.welcome.resumeToken));
    vi.advanceTimersByTime(6_000); // staggered bots plus 3-second countdown
    const racing = first.socket.sent.filter(message => message.type === 'state').at(-1)!;
    expect(racing.phase).toBe('racing');
    const prompt = racing.prompt as {text: string};
    first.socket.receive({ type: 'key', key: Array.from(prompt.text)[0] });
    vi.advanceTimersByTime(55);
    const typed = first.socket.sent.filter(message => message.type === 'state').at(-1)!;
    expect((typed.players as Array<{id: string;progress:number}>)
      .find(p => p.id === first.welcome.id)?.progress).toBe(1);
    first.socket.close();
    const recovered = await connect(doMatch, String(first.welcome.resumeToken));
    expect(recovered.welcome.resumed).toBe(true);
    expect(recovered.welcome.id).toBe(first.welcome.id);
    expect(recovered.snapshot.matchId).toBe(first.snapshot.matchId);
    expect((recovered.snapshot.players as Array<{id: string;progress:number;connected:boolean}>)
      .find(p => p.id === first.welcome.id)).toMatchObject({progress:1, connected:true});
  });
  it('evicts abandoned waiting connections so strict-mode remounts do not steal bot slots', async () => {
    const doMatch = new QuickMatchmaker();
    const ephemeral = await connect(doMatch);
    ephemeral.socket.close();
    const real = await connect(doMatch);
    vi.advanceTimersByTime(6_000);
    const state = real.socket.sent.filter(message => message.type === 'state').at(-1)!;
    expect(state.phase).toBe('racing');
    const players = state.players as Array<{id:string;bot:boolean}>;
    expect(players).toHaveLength(5);
    expect(players.filter(p => p.bot)).toHaveLength(4);
    expect(players.find(p => p.id === ephemeral.welcome.id)).toBeUndefined();
    expect(players.find(p => p.id === real.welcome.id)).toBeDefined();
  });
  it('refuses a guessed token and expires disconnected sessions after grace', async () => {
    const doMatch = new QuickMatchmaker();
    const first = await connect(doMatch);
    vi.advanceTimersByTime(6_000); // Resume grace applies to an actual racing match.
    first.socket.close();
    const stranger = await connect(doMatch, 'ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(stranger.welcome.id).not.toBe(first.welcome.id);
    expect(stranger.welcome.resumed).toBe(false);
    vi.advanceTimersByTime(QUICK_RECONNECT_GRACE_MS + 1);
    const expired = await connect(doMatch, String(first.welcome.resumeToken));
    expect(expired.welcome.id).not.toBe(first.welcome.id);
  });
});
