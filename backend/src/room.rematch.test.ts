import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RACE_DURATION_MS, START_COUNTDOWN_MS, type RoomSnapshot } from '@typeracer/shared';
import { RaceRoom } from './room';

class Socket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  listeners = new Map<string, (event: { data: string }) => void>();
  accept() {}
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  addEventListener(type: string, callback: (event: { data: string }) => void) { this.listeners.set(type, callback); }
  receive(message: unknown) { this.listeners.get('message')?.({ data: JSON.stringify(message) }); }
  state() { return this.sent.filter(m => m.type === 'state').at(-1) as RoomSnapshot; }
}
const sockets: Socket[] = [];
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T13:00:00Z'));
  sockets.length = 0;
  vi.stubGlobal('WebSocket', { OPEN: 1 });
  vi.stubGlobal('WebSocketPair', class {
    0 = new Socket(); 1 = new Socket();
    constructor() { sockets.push(this[1]); }
  });
  vi.stubGlobal('Response', class { constructor(_body: unknown, _options: unknown) {} });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function roomWithTwoPlayers() {
  const room = new RaceRoom({ storage: { get: async () => Date.now() } } as unknown as DurableObjectState, {});
  for (const name of ['First', 'Second']) await room.fetch(new Request('https://room.internal/ws?name='+name, { headers: { Upgrade: 'websocket' } }));
  return { room, first: sockets[0], second: sockets[1] };
}
describe('same-room rematch', () => {
  it('starts custom matches when the first timer callback is slightly early', async () => {
    const { first, second } = await roomWithTwoPlayers();
    first.receive({ type: 'ready' }); second.receive({ type: 'ready' });
    const startAt = first.state().startAt!;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(startAt - 1);
    vi.advanceTimersByTime(START_COUNTDOWN_MS);
    expect(first.state().phase).toBe('countdown');
    clock.mockRestore();
    vi.advanceTimersByTime(2);
    expect(first.state().phase).toBe('racing');
  });
  it('keeps players and cosmetics, resets results, changes text, and requires opponent readiness', async () => {
    const { first, second } = await roomWithTwoPlayers();
    const original = first.state();
    first.receive({ type: 'rematch', matchId: original.matchId });
    expect(first.state().matchId).toBe(original.matchId);
    first.receive({ type: 'ready' }); second.receive({ type: 'ready' });
    expect(first.state().startAt! - first.state().serverNow!).toBe(START_COUNTDOWN_MS);
    first.receive({ type: 'key', key: original.prompt.text[0] });
    vi.advanceTimersByTime(START_COUNTDOWN_MS + RACE_DURATION_MS);
    expect(first.state().phase).toBe('finished');
    first.receive({ type: 'rematch', matchId: original.matchId });
    const next = first.state();
    expect(next.phase).toBe('waiting'); expect(next.startAt).toBeNull();
    expect(next.matchId).not.toBe(original.matchId); expect(next.prompt.id).not.toBe(original.prompt.id);
    expect(next.players.map(p => [p.id, p.car])).toEqual(original.players.map(p => [p.id, p.car]));
    expect(next.players.map(p => [p.progress, p.strokes, p.mistakes, p.completedAt])).toEqual([[0,0,0,null],[0,0,0,null]]);
    expect(next.players.map(p => p.ready)).toEqual([true, false]);
    second.receive({ type: 'rematch', matchId: original.matchId });
    expect(first.state().matchId).toBe(next.matchId);
    second.receive({ type: 'ready' });
    vi.advanceTimersByTime(START_COUNTDOWN_MS);
    expect(first.state().phase).toBe('racing');
    first.receive({ type: 'key', key: next.prompt.text[0] });
    vi.advanceTimersByTime(55);
    expect(first.state().players[0].progress).toBe(1);
  });
  it('does not let a late rematch message reset the following finished race', async () => {
    const { first, second } = await roomWithTwoPlayers();
    const oldId = first.state().matchId;
    first.receive({ type: 'ready' }); second.receive({ type: 'ready' });
    vi.advanceTimersByTime(START_COUNTDOWN_MS + RACE_DURATION_MS);
    first.receive({ type: 'rematch', matchId: oldId });
    second.receive({ type: 'ready' });
    vi.advanceTimersByTime(START_COUNTDOWN_MS + RACE_DURATION_MS);
    const newId = first.state().matchId;
    first.receive({ type: 'rematch', matchId: oldId });
    expect(first.state().phase).toBe('finished'); expect(first.state().matchId).toBe(newId);
  });
});
