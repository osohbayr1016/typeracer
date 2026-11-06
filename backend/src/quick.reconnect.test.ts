import { RACE_DURATION_MS, characters } from '@typeracer/shared';
import { QUICK_BOT_ROSTER } from './quick';
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
async function connect(matchmaker: QuickMatchmaker, token?: string, modern = false) {
  const suffix = token ? '?resume=' + encodeURIComponent(token) : '';
  const response = await matchmaker.fetch(new Request('https://room.internal/quickplay' + (modern ? '?input=2' + (token ? '&resume=' + encodeURIComponent(token) : '') : suffix), {
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
  it('reschedules an early countdown timer instead of leaving the lobby stuck', async () => {
    const first = await connect(new QuickMatchmaker());
    vi.advanceTimersByTime(2600);
    const startAt = Number(first.socket.sent.filter(m => m.type === 'state').at(-1)!.startAt);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(startAt - 1);
    vi.advanceTimersByTime(2000);
    expect(first.socket.sent.filter(m => m.type === 'state').at(-1)!.phase).toBe('countdown');
    clock.mockRestore();
    vi.advanceTimersByTime(2);
    expect(first.socket.sent.filter(m => m.type === 'state').at(-1)!.phase).toBe('racing');
  });
  it('rejects early keys but accepts the first green key even before the countdown timer callback runs', async () => {
    const matchmaker = new QuickMatchmaker();
    const first = await connect(matchmaker);
    vi.advanceTimersByTime(2600);
    const state = first.socket.sent.filter(message => message.type === 'state').at(-1)!;
    expect(state.phase).toBe('countdown');
    const startAt = Number(state.startAt);
    const key = (state.prompt as { text: string }).text[0];
    vi.setSystemTime(startAt - 1);
    first.socket.receive({ type: 'key', key });
    vi.setSystemTime(startAt);
    first.socket.receive({ type: 'key', key });
    vi.advanceTimersByTime(55);
    const latest = first.socket.sent.filter(message => message.type === 'state').at(-1)!;
    expect(latest.phase).toBe('racing');
    expect((latest.players as Array<{ id: string; progress: number; strokes: number }>)
      .find(p => p.id === first.welcome.id)).toMatchObject({ progress: 1, strokes: 1 });
  });
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
  it('acknowledges contiguous keys once, repairs gaps, and preserves the sequence on reconnect', async () => {
    const matchmaker=new QuickMatchmaker();const first=await connect(matchmaker,undefined,true);
    expect(first.welcome.inputVersion).toBe(2);vi.advanceTimersByTime(6000);
    const state=first.socket.sent.filter(message=>message.type==='state').at(-1)!;
    const keys=characters((state.prompt as {text:string}).text);const matchId=state.matchId;
    first.socket.receive({type:'key',key:keys[0],seq:1,matchId});
    first.socket.receive({type:'key',key:keys[0],seq:1,matchId});
    first.socket.receive({type:'key',key:keys[2],seq:3,matchId});
    first.socket.receive({type:'key',key:keys[1],seq:2,matchId});vi.advanceTimersByTime(55);
    const latest=first.socket.sent.filter(message=>message.type==='state').at(-1)!;
    expect((latest.players as Array<Record<string,unknown>>).find(p=>p.id===first.welcome.id))
      .toMatchObject({progress:2,strokes:2,mistakes:0,inputSeq:2});
    first.socket.close();const next=await connect(matchmaker,String(first.welcome.resumeToken),true);
    next.socket.receive({type:'key',key:keys[2],seq:3,matchId});vi.advanceTimersByTime(55);
    const recovered=next.socket.sent.filter(message=>message.type==='state').at(-1)!;
    expect((recovered.players as Array<Record<string,unknown>>).find(p=>p.id===first.welcome.id))
      .toMatchObject({progress:3,strokes:3,inputSeq:3});
  });
  it('recovers a rate-limited key instead of permanently losing it or its accuracy', async()=>{
    const matchmaker=new QuickMatchmaker();const first=await connect(matchmaker,undefined,true);vi.advanceTimersByTime(6000);
    const state=first.socket.sent.filter(m=>m.type==='state').at(-1)!;
    const keys=characters((state.prompt as {text:string}).text);
    for(let i=0;i<36;i++)first.socket.receive({type:'key',key:keys[i],seq:i+1,matchId:state.matchId});
    expect(first.socket.sent.filter(m=>m.type==='input-ack').at(-1)).toMatchObject({seq:35,progress:35,strokes:35});
    vi.advanceTimersByTime(1001);first.socket.receive({type:'key',key:keys[35],seq:36,matchId:state.matchId});vi.advanceTimersByTime(55);
    const latest=first.socket.sent.filter(m=>m.type==='state').at(-1)!;
    expect((latest.players as Array<Record<string,unknown>>).find(p=>p.id===first.welcome.id))
      .toMatchObject({progress:36,strokes:36,mistakes:0,inputSeq:36});
  });
  it('enforces the race deadline even when its timer callback is delayed',async()=>{
    const first=await connect(new QuickMatchmaker(),undefined,true);vi.advanceTimersByTime(6000);
    const state=first.socket.sent.filter(m=>m.type==='state').at(-1)!;
    vi.setSystemTime(Number(state.startAt)+RACE_DURATION_MS+2000);
    first.socket.receive({type:'key',key:(state.prompt as {text:string}).text[0],seq:1,matchId:state.matchId});
    expect(first.socket.sent.filter(m=>m.type==='quick-result').at(-1)).toMatchObject({place:null,elapsedMs:RACE_DURATION_MS,wpm:0});
  });
  it('times bot finishes from their exact pace rather than the next simulation tick',async()=>{
    const first=await connect(new QuickMatchmaker());vi.advanceTimersByTime(60000);
    const state=first.socket.sent.filter(m=>m.type==='state').at(-1)!;
    const size=characters((state.prompt as {text:string}).text).length;
    for(const bot of (state.players as Array<{bot:boolean;name:string;completedAt:number}>).filter(p=>p.bot)){
      const pace=QUICK_BOT_ROSTER.find(p=>p.name===bot.name)!.pace;
      expect(bot.completedAt).toBe(Number(state.startAt)+Math.ceil(size/(pace*5)*60000));
    }
  });

});
