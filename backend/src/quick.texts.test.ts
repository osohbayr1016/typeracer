import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RACE_TEXT_MAX, RACE_TEXT_MIN, STORIES } from '@typeracer/shared';
import { QuickMatchmaker } from './quick';
import { RaceRoom } from './room';

class Socket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  listeners = new Map<string, (event: { data?: string }) => void>();
  accept() {}
  send(raw: string) { this.sent.push(JSON.parse(raw)); }
  addEventListener(type: string, callback: (event: { data?: string }) => void) { this.listeners.set(type, callback); }
  receive(message: unknown) { this.listeners.get('message')?.({ data: JSON.stringify(message) }); }
  close() { this.readyState = 3; this.listeners.get('close')?.({}); }
  state() { return this.sent.filter(m => m.type === 'state').at(-1) as { prompt: { text: string; title?: string; part?: string }; phase: string; matchId: string }; }
}
const sockets: Socket[] = [];
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T10:00:00Z'));
  sockets.length = 0;
  vi.stubGlobal('WebSocket', { OPEN: 1 });
  vi.stubGlobal('WebSocketPair', class { 0 = new Socket(); 1 = new Socket(); constructor() { sockets.push(this[1]); } });
  vi.stubGlobal('Response', class { status: number; constructor(_body: unknown, options?: { status?: number }) { this.status = options?.status ?? 200; } });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const length = (text: string) => Array.from(text.normalize('NFC')).length;
function expectStoryPassage(prompt: { text: string; title?: string; part?: string }) {
  expect(length(prompt.text)).toBeGreaterThanOrEqual(RACE_TEXT_MIN);
  expect(length(prompt.text)).toBeLessThanOrEqual(RACE_TEXT_MAX);
  expect(prompt.text).toMatch(/[ӨөҮү]/);
  const story = STORIES.find(item => item.title === prompt.title);
  expect(story, 'passage names its source story').toBeDefined();
  expect(prompt.part).toMatch(/^\d+(–\d+)?\/\d+$/);
  // Consecutive sentences of that one story: the passage has narrative context.
  expect(story!.sentences.join(' ')).toContain(prompt.text);
}

describe('generated race passages in live rooms', () => {
  it('public quick races serve a coherent story excerpt and rotate it between races', async () => {
    const matchmaker = new QuickMatchmaker();
    const texts = new Set<string>();
    for (let round = 0; round < 4; round++) {
      await matchmaker.fetch(new Request('https://room.internal/quickplay', { headers: { Upgrade: 'websocket' } }));
      const socket = sockets.at(-1)!;
      expectStoryPassage(socket.state().prompt);
      texts.add(socket.state().prompt.text);
      socket.close();
      vi.advanceTimersByTime(100);
    }
    expect(texts.size, 'consecutive public races never repeat a passage').toBe(4);
  });
  it('friend rooms start with a story excerpt and rematch with a different story', async () => {
    const room = new RaceRoom({ storage: { get: async () => Date.now() } } as unknown as DurableObjectState, {});
    for (const name of ['A', 'B']) await room.fetch(new Request('https://room.internal/ws?name=' + name, { headers: { Upgrade: 'websocket' } }));
    const [first, second] = sockets;
    const original = first.state();
    expectStoryPassage(original.prompt);
    first.receive({ type: 'ready' }); second.receive({ type: 'ready' });
    vi.advanceTimersByTime(2000 + 120_000);
    expect(first.state().phase).toBe('finished');
    first.receive({ type: 'rematch', matchId: original.matchId });
    const next = first.state();
    expectStoryPassage(next.prompt);
    expect(next.prompt.text).not.toBe(original.prompt.text);
    expect(next.prompt.title).not.toBe(original.prompt.title);
  });
});
