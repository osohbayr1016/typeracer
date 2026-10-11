import {
  choosePrompt, characters, RACE_DURATION_MS, wordsPerMinute,
  type Prompt, type Racer, type RoomSnapshot
} from '@typeracer/shared';
import { acceptKeystroke, safePlayerName } from './logic';

type Human = Racer & {
  socket: WebSocket; windowStart: number; windowCount: number; paid: boolean
};
type Bot = Racer & { bot: true; pace: number };
type QuickRace = {
  id: string; prompt: Prompt; phase: RoomSnapshot['phase'];
  humans: Set<Human>; bots: Bot[]; startAt: number | null;
  queueEndsAt: number; deadline: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  tick: ReturnType<typeof setInterval> | null;
  broadcastTimer: ReturnType<typeof setTimeout> | null;
};

/** Guest quick matches: public humans share a queue; server-generated robots fill empty lanes.
 * This is a small first-version queue hosted by one DO instance, not ranked matchmaking.
 * No wallet or account is authoritative until a persistent authenticated ledger exists.
 */
export const QUICK_QUEUE_MS = 5_000;
export const QUICK_COUNTDOWN_MS = 3_000;
export const QUICK_LANES = 4;
export const QUICK_MAX_HUMANS = 5;
export const QUICK_PRIZES = [120, 95, 75, 55, 40] as const;

const carIds = ['mint', 'sunset', 'purple', 'lime', 'phantom', 'steppe', 'thunder', 'midnight', 'khan', 'dawn', 'cosmic'];
const trailIds = ['none','ember','steppe','ice','aurora'];
const stickerIds = ['none','horse','bolt','star'];

function allowed(input: string | null, options: string[], defaultValue: string): string {
  return input && options.includes(input) ? input : defaultValue;
}
export function quickPlacement(player: Racer, opponents: Racer[]): number {
  return 1 + opponents.filter(p => p.id !== player.id && p.completedAt !== null &&
    (player.completedAt === null || p.completedAt < player.completedAt ||
      (p.completedAt === player.completedAt && p.id < player.id))).length;
}
export function quickPrize(place: number, finished: boolean): number {
  return finished ? QUICK_PRIZES[place - 1] ?? 30 : 0;
}

export class QuickMatchmaker {
  private pending: QuickRace | null = null;
  private active = new Set<QuickRace>();
  private sockets = new Map<WebSocket, { race: QuickRace; human: Human }>();

  fetch(request: Request): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket upgrade required', { status: 426 });
    if (this.sockets.size >= 160)
      return new Response('Public queue busy, retry shortly', { status: 503 });
    const url = new URL(request.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const human: Human = {
      id: crypto.randomUUID(), name: safePlayerName(url.searchParams.get('name') || ''),
      car: allowed(url.searchParams.get('car'), carIds, 'sunset'),
      trail: allowed(url.searchParams.get('trail'), trailIds, 'none'),
      sticker: allowed(url.searchParams.get('sticker'), stickerIds, 'none'),
      progress: 0, mistakes: 0, strokes: 0, completedAt: null,
      ready: true, socket: server, windowStart: 0, windowCount: 0, paid: false
    };
    let race = this.pending;
    if (!race || race.phase !== 'waiting' || race.humans.size >= QUICK_MAX_HUMANS) {
      race = this.newRace();
      this.pending = race;
    }
    race.humans.add(human);
    this.sockets.set(server, { race, human });
    server.accept();
    server.addEventListener('message', (event: MessageEvent) => this.receive(server, event.data));
    server.addEventListener('close', () => this.leave(server));
    server.addEventListener('error', () => this.leave(server));
    this.send(server, { type: 'welcome', id: human.id });
    this.broadcast(race);
    if (race.humans.size === QUICK_MAX_HUMANS) this.startCountdown(race);
    return new Response(null, { status: 101, webSocket: client });
  }

  private newRace(): QuickRace {
    const race: QuickRace = {
      id: crypto.randomUUID(), prompt: choosePrompt('mn'), phase: 'waiting',
      humans: new Set(), bots: [], startAt: null,
      queueEndsAt: Date.now() + QUICK_QUEUE_MS,
      deadline: null, countdownTimer: null, tick: null, broadcastTimer: null
    };
    this.active.add(race);
    race.deadline = setTimeout(() => this.startCountdown(race), QUICK_QUEUE_MS);
    return race;
  }

  private startCountdown(race: QuickRace): void {
    if (race.phase !== 'waiting') return;
    if (race.humans.size === 0) { this.dispose(race); return; }
    if (this.pending === race) this.pending = null;
    if (race.deadline) clearTimeout(race.deadline);
    race.deadline = null;
    const presets = [
      { name: 'Талын аянга', pace: 37, car: 'mint' },
      { name: 'Өглөөний салхи', pace: 52, car: 'steppe' },
      { name: 'Хурдан хүлэг', pace: 67, car: 'thunder' }
    ];
    const missing = Math.max(0, QUICK_LANES - race.humans.size);
    race.bots = presets.slice(0, missing).map((bot, i) => ({
      id: 'bot-' + race.id + '-' + i, name: bot.name, bot: true as const,
      car: bot.car, trail: 'none', sticker: 'none',
      progress: 0, mistakes: 0, strokes: 0, completedAt: null, ready: true, pace: bot.pace
    }));
    race.phase = 'countdown';
    race.startAt = Date.now() + QUICK_COUNTDOWN_MS;
    this.broadcast(race);
    race.countdownTimer = setTimeout(() => {
      if (race.phase !== 'countdown' || race.humans.size === 0) {
        this.dispose(race); return;
      }
      race.phase = 'racing';
      this.broadcast(race);
      race.tick = setInterval(() => this.tickBots(race), 200);
      race.deadline = setTimeout(() => this.finish(race), RACE_DURATION_MS);
    }, QUICK_COUNTDOWN_MS);
  }

  private tickBots(race: QuickRace): void {
    if (race.phase !== 'racing' || race.startAt === null) return;
    const now = Date.now();
    const size = characters(race.prompt.text).length;
    const elapsed = Math.max(0, now - race.startAt);
    for (const bot of race.bots) {
      if (bot.completedAt !== null) continue;
      const target = Math.min(size, Math.floor(elapsed / 60_000 * bot.pace * 5));
      bot.progress = Math.max(bot.progress, target);
      bot.strokes = bot.progress;
      if (bot.progress === size) bot.completedAt = now;
    }
    this.queueBroadcast(race);
  }

  private receive(socket: WebSocket, raw: unknown): void {
    const entry = this.sockets.get(socket);
    if (!entry || typeof raw !== 'string' || raw.length > 160) return;
    const { race, human } = entry;
    if (race.phase !== 'racing' || race.startAt === null || Date.now() < race.startAt ||
        human.completedAt !== null) return;
    let message: { type?: string; key?: unknown };
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type !== 'key') return;
    const now = Date.now();
    if (now - human.windowStart >= 1_000) { human.windowStart = now; human.windowCount = 0; }
    if (++human.windowCount > 35) return;
    const result = acceptKeystroke(race.prompt.text, human.progress, human.mistakes, human.strokes, message.key);
    if (result.strokes === human.strokes) return;
    human.progress = result.progress;
    human.mistakes = result.mistakes;
    human.strokes = result.strokes;
    if (human.progress >= characters(race.prompt.text).length) {
      human.completedAt = now;
      this.tickBots(race);
      this.awardFinish(race, human);
    }
    this.queueBroadcast(race);
    if ([...race.humans].every(p => p.completedAt !== null)) this.finish(race);
  }

  private awardFinish(race: QuickRace, human: Human): void {
    if (human.paid || human.completedAt === null || race.startAt === null) return;
    human.paid = true;
    const place = quickPlacement(human, [...race.humans, ...race.bots]);
    this.send(human.socket, {
      type: 'quick-result', raceId: race.id, place, coins: quickPrize(place, true),
      wpm: wordsPerMinute(human.progress, Math.max(1, human.completedAt - race.startAt)),
      accuracy: human.strokes ? Math.round((human.strokes - human.mistakes) / human.strokes * 100) : 100,
      elapsedMs: Math.max(1, human.completedAt - race.startAt), verified: false
    });
  }

  private finish(race: QuickRace): void {
    if (race.phase === 'finished') return;
    race.phase = 'finished';
    if (race.startAt !== null) this.tickBots(race);
    for (const human of race.humans) {
      if (human.completedAt !== null) this.awardFinish(race, human);
      else this.send(human.socket, { type: 'quick-result', raceId: race.id, place: null, coins: 0,
        wpm: wordsPerMinute(human.progress, Math.max(1, Date.now() - (race.startAt ?? Date.now()))),
        accuracy: human.strokes ? Math.round((human.strokes - human.mistakes) / human.strokes * 100) : 100,
        elapsedMs: Date.now() - (race.startAt ?? Date.now()), verified: false });
    }
    this.broadcast(race);
    this.stopTimers(race);
    // Keep final state visible briefly; moving to "play again" uses a fresh socket.
    race.deadline = setTimeout(() => this.dispose(race), 4_000);
  }

  private receiveSnapshot(race: QuickRace): RoomSnapshot {
    return {
      type: 'state', mode: 'quick', matchId: race.id,
      phase: race.phase, queueEndsAt: race.phase === 'waiting' ? race.queueEndsAt : null,
      startAt: race.startAt, durationMs: RACE_DURATION_MS, prompt: race.prompt,
      players: [...race.humans, ...race.bots].map(
        ({ id, name, car, trail, sticker, progress, mistakes, strokes, completedAt, ready, ...rest }) => ({
          id, name, car, trail, sticker, progress, mistakes, strokes, completedAt, ready,
          bot: 'bot' in rest && rest.bot === true
        }))
    };
  }
  private send(socket: WebSocket, value: unknown): void {
    try { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
    catch { this.leave(socket); }
  }
  private broadcast(race: QuickRace): void {
    const state = this.receiveSnapshot(race);
    for (const human of race.humans) this.send(human.socket, state);
  }
  private queueBroadcast(race: QuickRace): void {
    if (race.broadcastTimer) return;
    race.broadcastTimer = setTimeout(() => { race.broadcastTimer = null; this.broadcast(race); }, 50);
  }
  private leave(socket: WebSocket): void {
    const entry = this.sockets.get(socket);
    if (!entry) return;
    this.sockets.delete(socket);
    const { race, human } = entry;
    race.humans.delete(human);
    if (race.humans.size === 0) this.dispose(race);
    else this.broadcast(race);
  }
  private stopTimers(race: QuickRace): void {
    if (race.deadline) clearTimeout(race.deadline);
    if (race.countdownTimer) clearTimeout(race.countdownTimer);
    if (race.tick) clearInterval(race.tick);
    if (race.broadcastTimer) clearTimeout(race.broadcastTimer);
    race.deadline = race.countdownTimer = race.broadcastTimer = null;
    race.tick = null;
  }
  private dispose(race: QuickRace): void {
    this.stopTimers(race);
    if (this.pending === race) this.pending = null;
    this.active.delete(race);
    for (const human of race.humans) {
      this.sockets.delete(human.socket);
      try { human.socket.close(1000, 'Match ended'); } catch { /* socket already closed */ }
    }
    race.humans.clear();
  }
}
