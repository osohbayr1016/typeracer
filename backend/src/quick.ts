import {
  choosePrompt, characters, RACE_DURATION_MS, wordsPerMinute,
  type Prompt, type Racer, type RoomSnapshot
} from '@typeracer/shared';
import { acceptKeystroke, safePlayerName } from './logic';

type QuickResult = {
  type: 'quick-result'; raceId: string; place: number | null; coins: number;
  wpm: number; accuracy: number; elapsedMs: number; verified: false;
  /** All competitors at the result instant; unfinished racers stay visibly unfinished. */
  standings: Racer[];
};
type Human = Racer & {
  socket: WebSocket | null; windowStart: number; windowCount: number; paid: boolean;
  resumeToken: string; disconnectTimer: ReturnType<typeof setTimeout> | null;
  lastResult: QuickResult | null;
};
type Bot = Racer & { bot: true; pace: number };
type QuickRace = {
  id: string; prompt: Prompt; phase: RoomSnapshot['phase'];
  humans: Set<Human>; bots: Bot[]; startAt: number | null;
  queueEndsAt: number; deadline: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  tick: ReturnType<typeof setInterval> | null;
  botJoinTimer: ReturnType<typeof setInterval> | null;
  botSequence: number;
  botOffset: number;
  broadcastTimer: ReturnType<typeof setTimeout> | null;
};

/** Guest quick matches: public humans share a queue; server-generated robots fill empty lanes.
 * This is a small first-version queue hosted by one DO instance, not ranked matchmaking.
 * No wallet or account is authoritative until a persistent authenticated ledger exists.
 */
export const QUICK_QUEUE_MS = 5_000;
export const QUICK_COUNTDOWN_MS = 3_000;
export const QUICK_LANES = 5;
export const QUICK_MAX_HUMANS = 5;
export const QUICK_PRIZES = [120, 95, 75, 55, 40] as const;
export const QUICK_BOT_JOIN_MS = 650;
/** Grace period for a disconnected public-race player in the current Durable Object instance. */
export const QUICK_RECONNECT_GRACE_MS = 15_000;

/** Original Mongolian guest bot roster. Bots are identified as bots in every snapshot.
 * Starting at an offset varies the lineup across consecutive races, without duplicate names.
 */
export const QUICK_BOT_ROSTER = [
  { name: 'Талын аянга', pace: 39, car: 'mint' },
  { name: 'Өглөөний салхи', pace: 51, car: 'steppe' },
  { name: 'Хурдан хүлэг', pace: 67, car: 'thunder' },
  { name: 'Хөх чоно', pace: 74, car: 'midnight' },
  { name: 'Уудам тал', pace: 43, car: 'dawn' },
  { name: 'Алтан соёмбо', pace: 81, car: 'khan' },
  { name: 'Говийн шонхор', pace: 57, car: 'sunset' },
  { name: 'Мөнгөн сум', pace: 90, car: 'cosmic' },
  { name: 'Өндөр уул', pace: 48, car: 'purple' },
  { name: 'Цахилгаан Үүл', pace: 100, car: 'lime' },
  { name: 'Салхин жигүүр', pace: 63, car: 'phantom' },
  { name: 'Тэнгэрийн нум', pace: 79, car: 'mint' },
  { name: 'Үүрийн од', pace: 55, car: 'dawn' },
  { name: 'Хүлэг баатар', pace: 86, car: 'thunder' },
  { name: 'Хөх тэнгэр', pace: 72, car: 'steppe' }
] as const;
export function quickBotForSlot(offset: number, slot: number) {
  return QUICK_BOT_ROSTER[((offset + slot) % QUICK_BOT_ROSTER.length + QUICK_BOT_ROSTER.length) % QUICK_BOT_ROSTER.length];
}


const carIds = ['mint', 'sunset', 'purple', 'lime', 'phantom', 'steppe', 'thunder', 'midnight', 'khan', 'dawn', 'cosmic', 'falcon', 'nomad', 'rover', 'sunflare', 'dune', 'cobalt', 'glacier', 'fox', 'streak', 'ghost', 'onyx', 'meteor', 'temple', 'nebula', 'eagle', 'royal', 'aurora-x', 'dragon'];
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
  return finished ? QUICK_PRIZES[place - 1] ?? 0 : 0;
}

export class QuickMatchmaker {
  private pending: QuickRace | null = null;
  private active = new Set<QuickRace>();
  private sockets = new Map<WebSocket, { race: QuickRace; human: Human }>();

  fetch(request: Request): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket upgrade required', { status: 426 });
    const url = new URL(request.url);
    const token = url.searchParams.get('resume');
    // Cryptographically random, short-lived bearer token. Never include it in
    // public snapshots; it only rebinds one socket to an existing DO race.
    const existing = token && /^[0-9a-f-]{36}$/.test(token) ? [...this.active]
      .flatMap(race => [...race.humans].map(human => ({ race, human })))
      .find(entry => entry.human.resumeToken === token) : undefined;
    if (!existing && this.sockets.size >= 160)
      return new Response('Public queue busy, retry shortly', { status: 503 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    if (existing) {
      const { race, human } = existing;
      const old = human.socket;
      if (old) {
        this.sockets.delete(old);
        try { old.close(1000, 'Session resumed'); } catch { /* already closed */ }
      }
      if (human.disconnectTimer) clearTimeout(human.disconnectTimer);
      human.disconnectTimer = null;
      human.socket = server;
      this.attach(server, race, human);
      this.send(server, { type: 'welcome', id: human.id, resumeToken: human.resumeToken, resumed: true });
      // Immediate authoritative snapshot: do not wait for the 50ms fan-out tick.
      this.send(server, this.receiveSnapshot(race));
      if (human.lastResult) this.send(server, human.lastResult);
      this.broadcast(race);
      return new Response(null, { status: 101, webSocket: client });
    }

    const human: Human = {
      id: crypto.randomUUID(), name: safePlayerName(url.searchParams.get('name') || ''),
      car: allowed(url.searchParams.get('car'), carIds, 'sunset'),
      trail: allowed(url.searchParams.get('trail'), trailIds, 'none'),
      sticker: allowed(url.searchParams.get('sticker'), stickerIds, 'none'),
      progress: 0, mistakes: 0, strokes: 0, completedAt: null,
      ready: true, socket: server, windowStart: 0, windowCount: 0, paid: false,
      resumeToken: crypto.randomUUID(), disconnectTimer: null, lastResult: null
    };
    let race = this.pending;
    if (!race || race.phase !== 'waiting' || race.humans.size >= QUICK_MAX_HUMANS) {
      race = this.newRace();
      this.pending = race;
    }
    race.humans.add(human);
    // Replace the last bot with an incoming real racer while matchmaking is open.
    while (race.humans.size + race.bots.length > QUICK_LANES) race.bots.pop();
    this.attach(server, race, human);
    this.send(server, { type: 'welcome', id: human.id, resumeToken: human.resumeToken, resumed: false });
    this.broadcast(race);
    if (race.humans.size === QUICK_MAX_HUMANS) this.startCountdown(race);
    return new Response(null, { status: 101, webSocket: client });
  }

  private attach(socket: WebSocket, race: QuickRace, human: Human): void {
    socket.accept();
    this.sockets.set(socket, { race, human });
    socket.addEventListener('message', (event: MessageEvent) => this.receive(socket, event.data));
    socket.addEventListener('close', () => this.leave(socket));
    socket.addEventListener('error', () => this.leave(socket));
  }

  private newRace(): QuickRace {
    const race: QuickRace = {
      id: crypto.randomUUID(), prompt: choosePrompt('mn'), phase: 'waiting',
      humans: new Set(), bots: [], startAt: null,
      queueEndsAt: Date.now() + QUICK_QUEUE_MS,
      deadline: null, countdownTimer: null, tick: null, broadcastTimer: null,
      botJoinTimer: null, botSequence: 0,
      botOffset: Math.floor(Math.random() * QUICK_BOT_ROSTER.length)
    };
    this.active.add(race);
    // Add one identifiable bot at a time so the lobby visibly fills, like people
    // arriving at the starting line. Keep the queue open for real humans until timeout.
    race.botJoinTimer = setInterval(() => this.joinBot(race), QUICK_BOT_JOIN_MS);
    race.deadline = setTimeout(() => this.startCountdown(race), QUICK_QUEUE_MS);
    return race;
  }

  private joinBot(race: QuickRace, autoStart = true): void {
    if (race.phase !== 'waiting' || race.humans.size === 0) return;
    if (race.humans.size + race.bots.length >= QUICK_LANES) return;
    const slot = race.botSequence++;
    const preset = quickBotForSlot(race.botOffset, slot);
    race.bots.push({
      id: 'bot-' + race.id + '-' + slot, name: preset.name,
      bot: true, car: preset.car, trail: 'none', sticker: 'none',
      progress: 0, mistakes: 0, strokes: 0, completedAt: null,
      ready: true, pace: preset.pace
    });
    this.broadcast(race);
    // Once the five-player grid is full, move straight to the ONLY visible
    // countdown. Do not keep a separate "search timeout" running on screen.
    if (autoStart && race.humans.size + race.bots.length === QUICK_LANES) this.startCountdown(race);
  }

  private startCountdown(race: QuickRace): void {
    if (race.phase !== 'waiting') return;
    if (race.humans.size === 0) { this.dispose(race); return; }
    if (this.pending === race) this.pending = null;
    if (race.deadline) clearTimeout(race.deadline);
    if (race.botJoinTimer) clearInterval(race.botJoinTimer);
    race.deadline = null;
    race.botJoinTimer = null;
    // All competitors are present before the 3-second countdown begins.
    // Remaining slots may occur if the event loop was briefly suspended.
    while (race.humans.size + race.bots.length < QUICK_LANES) this.joinBot(race, false);
    race.phase = 'countdown';
    race.startAt = Date.now() + QUICK_COUNTDOWN_MS;
    this.broadcast(race);
    race.countdownTimer = setTimeout(() => {
      if (race.phase !== 'countdown' || race.humans.size === 0) {
        this.dispose(race); return;
      }
      race.phase = 'racing';
      this.broadcast(race);
      race.tick = setInterval(() => this.tickBots(race), 180);
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
    human.lastResult = {
      type: 'quick-result', raceId: race.id, place, coins: quickPrize(place, true),
      wpm: wordsPerMinute(human.progress, Math.max(1, human.completedAt - race.startAt)),
      accuracy: human.strokes ? Math.round((human.strokes - human.mistakes) / human.strokes * 100) : 100,
      elapsedMs: Math.max(1, human.completedAt - race.startAt), verified: false, standings: this.receiveSnapshot(race).players
    };
    this.send(human.socket, human.lastResult);
  }

  private finish(race: QuickRace): void {
    if (race.phase === 'finished') return;
    race.phase = 'finished';
    if (race.startAt !== null) this.tickBots(race);
    for (const human of race.humans) {
      if (human.completedAt !== null) this.awardFinish(race, human);
      else {
        human.lastResult = { type: 'quick-result', raceId: race.id, place: null, coins: 0,
          wpm: wordsPerMinute(human.progress, Math.max(1, Date.now() - (race.startAt ?? Date.now()))),
          accuracy: human.strokes ? Math.round((human.strokes - human.mistakes) / human.strokes * 100) : 100,
          elapsedMs: Date.now() - (race.startAt ?? Date.now()), verified: false, standings: this.receiveSnapshot(race).players };
        this.send(human.socket, human.lastResult);
      }
    }
    this.broadcast(race);
    this.stopTimers(race);
    // Permit recently disconnected racers to recover their authoritative result.
    race.deadline = setTimeout(() => this.dispose(race),
      [...race.humans].some(h => h.socket === null) ? QUICK_RECONNECT_GRACE_MS : 4_000);
  }

  private receiveSnapshot(race: QuickRace): RoomSnapshot {
    return {
      type: 'state', mode: 'quick', matchId: race.id,
      phase: race.phase, queueEndsAt: race.phase === 'waiting' ? race.queueEndsAt : null,
      startAt: race.startAt, durationMs: RACE_DURATION_MS, prompt: race.prompt,
      players: [...race.humans, ...race.bots].map(
        ({ id, name, car, trail, sticker, progress, mistakes, strokes, completedAt, ready, ...rest }) => ({
          id, name, car, trail, sticker, progress, mistakes, strokes, completedAt, ready,
          bot: 'bot' in rest && rest.bot === true,
          connected: 'socket' in rest ? rest.socket !== null : true
        }))
    };
  }
  private send(socket: WebSocket | null, value: unknown): void {
    if (!socket) return;
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
    // Closing an old socket after a successful resume cannot evict its new owner.
    if (human.socket !== socket) return;
    human.socket = null;
    // Waiting racers have no progress to recover. Evict immediately so a
    // React StrictMode double-mount or closed tab cannot occupy a ghost lobby
    // slot, reduce bot fill or start a countdown with departed players.
    if (race.phase === 'waiting' || race.phase === 'finished') {
      race.humans.delete(human);
      if (race.humans.size === 0) this.dispose(race);
      else this.broadcast(race);
      return;
    }
    if (human.disconnectTimer) clearTimeout(human.disconnectTimer);
    human.disconnectTimer = setTimeout(() => {
      human.disconnectTimer = null;
      if (human.socket !== null) return;
      race.humans.delete(human);
      if (race.humans.size === 0) this.dispose(race);
      else this.broadcast(race);
    }, QUICK_RECONNECT_GRACE_MS);
    // Preserve race progress and the player slot during a brief network outage.
    this.broadcast(race);
  }
  private stopTimers(race: QuickRace): void {
    if (race.deadline) clearTimeout(race.deadline);
    if (race.countdownTimer) clearTimeout(race.countdownTimer);
    if (race.tick) clearInterval(race.tick);
    if (race.botJoinTimer) clearInterval(race.botJoinTimer);
    if (race.broadcastTimer) clearTimeout(race.broadcastTimer);
    race.deadline = race.countdownTimer = race.broadcastTimer = null;
    race.tick = race.botJoinTimer = null;
  }
  private dispose(race: QuickRace): void {
    this.stopTimers(race);
    if (this.pending === race) this.pending = null;
    this.active.delete(race);
    for (const human of race.humans) {
      if (human.disconnectTimer) clearTimeout(human.disconnectTimer);
      human.disconnectTimer = null;
      if (human.socket) {
        this.sockets.delete(human.socket);
        try { human.socket.close(1000, 'Match ended'); } catch { /* socket already closed */ }
      }
      human.socket = null;
    }
    race.humans.clear();
  }
}
