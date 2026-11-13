import {
  generatePassage, characters, RACE_DURATION_MS, START_COUNTDOWN_MS, wordsPerMinute,
  advanceTyping, typingKey, premiumCosmeticAllowed, type Prompt, type Racer, type RoomSnapshot
} from '@typeracer/shared';
import { safePlayerName } from './logic';
import { RaceRankingStore } from './rankings';
import { EarnedProgressionStore } from './earned';
import { purchasedInventory } from './payments';
import { QuickCheckpointStore, type QuickCheckpoint } from './quickCheckpoint';

type QuickResult = {
  type: 'quick-result'; raceId: string; place: number | null; coins: number;
  wpm: number; accuracy: number; elapsedMs: number; verified: false;
  /** All competitors at the result instant; unfinished racers stay visibly unfinished. */
  standings: Racer[];
};
type Human = Racer & {
  socket: WebSocket | null; windowStart: number; windowCount: number; paid: boolean;
  resumeToken: string; disconnectTimer: ReturnType<typeof setTimeout> | null;
  lastResult: QuickResult | null; accountId: string | null; inputVersion: 1 | 2; inputSeq: number; inputWrong: boolean;
};
type Bot = Racer & { bot: true; pace: number };
type QuickRace = {
  id: string; prompt: Prompt; letters: string[]; phase: RoomSnapshot['phase'];
  humans: Set<Human>; bots: Bot[]; startAt: number | null;
  queueEndsAt: number; deadline: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  tick: ReturnType<typeof setInterval> | null;
  botJoinTimer: ReturnType<typeof setInterval> | null;
  botSequence: number;
  botOffset: number;
  humanCountAtStart: number;
  broadcastTimer: ReturnType<typeof setTimeout> | null;
};

/** Guest quick matches: public humans share a queue; server-generated robots fill empty lanes.
 * This is a small first-version queue hosted by one DO instance, not ranked matchmaking.
 * No wallet or account is authoritative until a persistent authenticated ledger exists.
 */
export const QUICK_QUEUE_MS = 5_000;
export const QUICK_COUNTDOWN_MS = START_COUNTDOWN_MS;
export const QUICK_LANES = 5;
export const QUICK_MAX_HUMANS = 5;
/** Transparent non-pay-to-win place coins: 18–30 per finished quick race.
 * Competitive leaderboard points are a separate server-calculated metric. */
export const QUICK_PRIZES = [30, 27, 24, 21, 18] as const;
export const QUICK_BOT_JOIN_MS = 650;
/** Bots fill the visible grid but must not close the five-second human queue. */
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


const carIds = ['mint', 'sunset', 'purple', 'lime', 'phantom', 'steppe', 'thunder', 'midnight', 'khan', 'dawn', 'cosmic', 'falcon', 'nomad', 'rover', 'sunflare', 'dune', 'cobalt', 'glacier', 'fox', 'streak', 'ghost', 'onyx', 'meteor', 'temple', 'nebula', 'eagle', 'royal', 'aurora-x', 'dragon', 'side-common-graphite', 'side-uncommon-cobalt', 'side-rare-lightning', 'side-epic-violet', 'side-mythic-emerald', 'side-legend-cyber'];
const trailIds = ['none','ember','steppe','ice','aurora','gold'];
const stickerIds = ['none','horse','bolt','star','crown'];

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
/** PvP beta: count only live, distinct human accounts at the start signal.
 * Two tabs on the same account cannot create a human-vs-human match.
 */
export function connectedHumanCount(entries: Iterable<{
  id: string; accountId: string | null; socket: {readyState: number} | null;
}>): number {
  const humans = new Set<string>();
  for (const player of entries) {
    if (player.socket?.readyState !== 1) continue;
    humans.add(player.accountId ? 'account:' + player.accountId : 'guest:' + player.id);
  }
  return humans.size;
}

export class QuickMatchmaker {
  readonly rankings: RaceRankingStore | null;
  readonly earned: EarnedProgressionStore | null;
  readonly checkpoints: QuickCheckpointStore | null;
  constructor(private storage?: DurableObjectStorage) {
    this.rankings = storage ? new RaceRankingStore(storage.sql,
      storage.transactionSync ? operation => storage.transactionSync(operation) : undefined) : null;
    this.checkpoints = storage ? new QuickCheckpointStore(storage.sql) : null;
    this.earned = storage ? new EarnedProgressionStore(storage.sql,
      storage.transactionSync ? operation => storage.transactionSync(operation) : undefined) : null;
  }
  private pending: QuickRace | null = null;
  private active = new Set<QuickRace>();
  private sockets = new Map<WebSocket, { race: QuickRace; human: Human }>();

  /** Persist only serializable, accepted race state; never sockets or timers. */
  private saveRace(race: QuickRace): void {
    if (!this.checkpoints) return;
    const record: QuickCheckpoint = {
      id:race.id, prompt:race.prompt, phase:race.phase, startAt:race.startAt,
      queueEndsAt:race.queueEndsAt, botSequence:race.botSequence, botOffset:race.botOffset,
      humanCountAtStart:race.humanCountAtStart,
      humans:[...race.humans].map(({socket,disconnectTimer,windowStart,windowCount,...h})=>h),
      bots:race.bots.map(b=>({...b}))
    };
    const remaining = race.startAt === null
      ? RACE_DURATION_MS + QUICK_QUEUE_MS + QUICK_COUNTDOWN_MS + QUICK_RECONNECT_GRACE_MS
      : Math.max(QUICK_RECONNECT_GRACE_MS, race.startAt+RACE_DURATION_MS+QUICK_RECONNECT_GRACE_MS-Date.now());
    this.checkpoints.save(record, Date.now()+
      (race.phase === 'finished' ? QUICK_RECONNECT_GRACE_MS : remaining));
  }

  /** Rehydrate one match on a valid token. Server time restores phase and bots. */
  private restore(token: string): {race: QuickRace; human: Human} | undefined {
    const saved=this.checkpoints?.findByToken(token);
    if (!saved) return undefined;
    let race=[...this.active].find(item=>item.id===saved.id);
    if (!race) {
      race={
        id:saved.id,prompt:saved.prompt,letters:characters(saved.prompt.text),
        phase:saved.phase,startAt:saved.startAt,queueEndsAt:saved.queueEndsAt,
        humans:new Set(saved.humans.map(h=>({
          ...h,socket:null,disconnectTimer:null,windowStart:0,windowCount:0
        }))),bots:saved.bots,botSequence:saved.botSequence,botOffset:saved.botOffset,
        humanCountAtStart:saved.humanCountAtStart??0,
        deadline:null,countdownTimer:null,tick:null,botJoinTimer:null,broadcastTimer:null
      };
      this.active.add(race);
      if (race.phase==='waiting') {
        if (!this.pending) this.pending=race;
        race.botJoinTimer=setInterval(()=>this.joinBot(race!),QUICK_BOT_JOIN_MS);
        race.deadline=setTimeout(()=>this.startCountdown(race!),Math.max(0,race.queueEndsAt-Date.now()));
      } else if (race.phase==='countdown') {
        race.countdownTimer=setTimeout(()=>this.beginRace(race!),Math.max(0,(race.startAt??Date.now())-Date.now()));
        if (race.startAt!==null && Date.now()>=race.startAt) this.beginRace(race);
      } else if (race.phase==='racing') {
        if (race.startAt!==null && Date.now()>=race.startAt+RACE_DURATION_MS) this.finish(race);
        else {
          this.tickBots(race);
          race.tick=setInterval(()=>this.tickBots(race!),100);
          race.deadline=setTimeout(()=>this.finish(race!),Math.max(0,(race.startAt??Date.now())+RACE_DURATION_MS-Date.now()));
        }
      }
      if (race.phase==='finished') {
        race.deadline=setTimeout(()=>this.dispose(race!),QUICK_RECONNECT_GRACE_MS);
      } else {
        for (const human of race.humans) {
          human.disconnectTimer=setTimeout(()=>{
            human.disconnectTimer=null;
            if (human.socket!==null) return;
            race!.humans.delete(human);
            if (!race!.humans.size) this.dispose(race!);
            else {this.saveRace(race!);this.broadcast(race!);}
          },QUICK_RECONNECT_GRACE_MS);
        }
      }
    }
    const human=[...race.humans].find(h=>h.resumeToken===token);
    return human?{race,human}:undefined;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket upgrade required', { status: 426 });
    const url = new URL(request.url);
    const token = url.searchParams.get('resume');
    // Cryptographically random, short-lived bearer token. Never include it in
    // public snapshots; it only rebinds one socket to an existing DO race.
    const existing = token && /^[0-9a-f-]{36}$/.test(token)
      ? ([...this.active].flatMap(race=>[...race.humans].map(human=>({race,human})))
         .find(entry=>entry.human.resumeToken===token) ?? this.restore(token))
      : undefined;
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
      if (human.completedAt !== null && !human.lastResult) this.awardFinish(race,human);
      this.saveRace(race);
      this.send(server, { type: 'welcome', id: human.id, resumeToken: human.resumeToken, resumed: true, inputVersion: human.inputVersion });
      // Immediate authoritative snapshot: do not wait for the 50ms fan-out tick.
      this.send(server, this.receiveSnapshot(race));
      if (human.lastResult) this.send(server, human.lastResult);
      this.broadcast(race);
      return new Response(null, { status: 101, webSocket: client });
    }

    const account = await this.rankings?.fromCookie(request.headers.get('Cookie')) ?? null;
    const inventory = this.storage && typeof account?.id === 'string' ? purchasedInventory(this.storage.sql, account.id) : [];
    const cosmetic = (kind: string, value: string | null, choices: string[], fallback: string) =>
      value && premiumCosmeticAllowed(kind, value, inventory) ? allowed(value, choices, fallback) : fallback;
    const human: Human = {
      id: crypto.randomUUID(), name: safePlayerName(url.searchParams.get('name') || ''),
      car: allowed(url.searchParams.get('car'), carIds, 'sunset'),
      trail: cosmetic('trail', url.searchParams.get('trail'), trailIds, 'none'),
      sticker: cosmetic('sticker', url.searchParams.get('sticker'), stickerIds, 'none'),
      title: cosmetic('title', url.searchParams.get('title'), ['rookie','swift','khan','legend','supporter'], 'rookie'),
      progress: 0, mistakes: 0, strokes: 0, completedAt: null,
      ready: true, socket: server, windowStart: 0, windowCount: 0, paid: false,
      inputVersion: url.searchParams.get('input') === '2' ? 2 : 1, inputSeq: 0, inputWrong: false,
      resumeToken: crypto.randomUUID(), disconnectTimer: null, lastResult: null,
      accountId: typeof account?.id === 'string' ? account.id : null
    };
    let race = this.pending;
    if (!race || race.phase !== 'waiting' || race.humans.size >= QUICK_MAX_HUMANS) {
      race = this.newRace();
      this.pending = race;
    }
    race.humans.add(human);
    this.checkpoints?.register(race.id,human.resumeToken,Date.now()+
      RACE_DURATION_MS+QUICK_QUEUE_MS+QUICK_COUNTDOWN_MS+QUICK_RECONNECT_GRACE_MS*2);
    // Replace the last bot with an incoming real racer while matchmaking is open.
    while (race.humans.size + race.bots.length > QUICK_LANES) race.bots.pop();
    this.attach(server, race, human);
    this.saveRace(race);
    this.send(server, { type: 'welcome', id: human.id, resumeToken: human.resumeToken, resumed: false, inputVersion: human.inputVersion });
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

  private lastPromptText = '';
  private newRace(): QuickRace {
    // A fresh story excerpt per race; never the same passage twice in a row.
    const prompt = generatePassage({ mode: 'story', exclude: this.lastPromptText });
    this.lastPromptText = prompt.text;
    const race: QuickRace = {
      id: crypto.randomUUID(), prompt, letters: characters(prompt.text), phase: 'waiting',
      humans: new Set(), bots: [], startAt: null,
      queueEndsAt: Date.now() + QUICK_QUEUE_MS,
      deadline: null, countdownTimer: null, tick: null, broadcastTimer: null,
      botJoinTimer: null, botSequence: 0,
      botOffset: Math.floor(Math.random() * QUICK_BOT_ROSTER.length),
      humanCountAtStart: 0
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
    this.saveRace(race);
    this.broadcast(race);
    // Retain the original deadline to allow later humans to replace bots.
    void autoStart;
  }

  private startCountdown(race: QuickRace): void {
    if (race.phase !== 'waiting') return;
    if (race.humans.size === 0) { this.dispose(race); return; }
    if (this.pending === race) this.pending = null;
    if (race.deadline) clearTimeout(race.deadline);
    if (race.botJoinTimer) clearInterval(race.botJoinTimer);
    race.deadline = null;
    race.botJoinTimer = null;
    // Red and yellow each last one second before the shared green deadline.
    // Remaining slots may occur if the event loop was briefly suspended.
    while (race.humans.size + race.bots.length < QUICK_LANES) this.joinBot(race, false);
    race.phase = 'countdown';
    race.startAt = Date.now() + QUICK_COUNTDOWN_MS;
    this.saveRace(race);
    this.broadcast(race);
    race.countdownTimer = setTimeout(() => this.beginRace(race), QUICK_COUNTDOWN_MS);
  }

  private beginRace(race: QuickRace): void {
    if (race.phase !== 'countdown' || race.startAt === null) return;
    const remaining = race.startAt - Date.now();
    if (remaining > 0) {
      if (race.countdownTimer) clearTimeout(race.countdownTimer);
      race.countdownTimer = setTimeout(() => this.beginRace(race), remaining);
      return;
    }
    if (race.humans.size === 0) { this.dispose(race); return; }
    race.phase = 'racing';
    // Count humans actually present at the green light, not lobby bots.
    race.humanCountAtStart = connectedHumanCount(race.humans);
    this.saveRace(race);
    this.broadcast(race);
    race.tick = setInterval(() => this.tickBots(race), 100);
    race.deadline = setTimeout(() => this.finish(race), Math.max(0, race.startAt + RACE_DURATION_MS - Date.now()));
  }

  private tickBots(race: QuickRace): void {
    if (race.phase !== 'racing' || race.startAt === null) return;
    const now = Date.now();
    const size = race.letters.length;
    const elapsed = Math.max(0, Math.min(RACE_DURATION_MS, now - race.startAt));
    let changed = false;
    for (const bot of race.bots) {
      if (bot.completedAt !== null) continue;
      const target = Math.min(size, Math.floor(elapsed / 60_000 * bot.pace * 5));
      if (target !== bot.progress) changed = true;
      bot.progress = Math.max(bot.progress, target);
      bot.strokes = bot.progress;
      if (bot.progress === size) bot.completedAt = race.startAt + Math.ceil(size / (bot.pace * 5) * 60_000);
    }
    if (changed) this.queueBroadcast(race);
  }

  private receive(socket: WebSocket, raw: unknown): void {
    const entry = this.sockets.get(socket);
    if (!entry || typeof raw !== 'string' || raw.length > 160) return;
    const { race, human } = entry;
    // A delayed event-loop timer must not discard the first key at the green deadline.
    if (race.phase === 'countdown') this.beginRace(race);
    if (race.phase !== 'racing' || race.startAt === null || Date.now() < race.startAt ||
        human.completedAt !== null) return;
    let message: { type?: string; key?: unknown; seq?: unknown; matchId?: unknown };
    try { message = JSON.parse(raw); } catch { return; }
    if (!message || typeof message !== 'object') return;
    if (message.type !== 'key' || typingKey(message.key) === null) return;
    const now = Date.now();
    if (now >= race.startAt + RACE_DURATION_MS) { this.finish(race); return; }
    const acknowledge = () => this.send(human.socket, { type: 'input-ack', matchId: race.id, seq: human.inputSeq,
      progress: human.progress, strokes: human.strokes, mistakes: human.mistakes, wrong: human.inputWrong });
    if (human.inputVersion === 2 && (message.matchId !== race.id || !Number.isSafeInteger(message.seq) ||
        message.seq !== human.inputSeq + 1)) { acknowledge(); return; }
    if (now - human.windowStart >= 1_000) { human.windowStart = now; human.windowCount = 0; }
    if (++human.windowCount > 35) { if (human.inputVersion === 2) acknowledge(); return; }
    const result = advanceTyping(race.letters, {progress:human.progress,strokes:human.strokes,mistakes:human.mistakes,wrong:false}, message.key);
    if (result.strokes === human.strokes) return;
    if (human.inputVersion === 2) human.inputSeq = Number(message.seq);
    human.inputWrong = result.wrong;
    human.progress = result.progress;
    human.mistakes = result.mistakes;
    human.strokes = result.strokes;
    if (human.progress >= race.letters.length) {
      human.completedAt = now;
      this.tickBots(race);
      this.awardFinish(race, human);
    }
    this.saveRace(race);
    this.queueBroadcast(race);
    if ([...race.humans].every(p => p.completedAt !== null)) this.finish(race);
  }

  private awardFinish(race: QuickRace, human: Human): void {
    if (human.paid || human.completedAt === null || race.startAt === null) return;
    const place = quickPlacement(human, [...race.humans, ...race.bots]);
    const result: QuickResult = {
      type: 'quick-result', raceId: race.id, place, coins: quickPrize(place, true),
      wpm: wordsPerMinute(human.progress, Math.max(1, human.completedAt - race.startAt)),
      accuracy: human.strokes ? Math.round((human.strokes - human.mistakes) / human.strokes * 100) : 100,
      elapsedMs: Math.max(1, human.completedAt - race.startAt), verified: false, standings: this.receiveSnapshot(race).players
    };
    // The only leaderboard writer is the authoritative Durable Object finish.
    // Guest clients cannot submit WPM, accuracy, points, or bots to this store.
    if (human.accountId) {
      try {
        // Retry-safe independent ledgers: a crash after score write but before
        // earned credit retries both, with each ledger deduplicating race+account.
        this.rankings?.record(race.id, human.accountId,
          result.wpm, result.accuracy, human.completedAt,
          race.humanCountAtStart >= 2);
        this.earned?.creditRace({
          raceId:race.id,playerId:human.accountId,place,
          coins:result.coins,wpm:result.wpm,accuracy:result.accuracy,
          finishedAt:human.completedAt
        });
      } catch (error) {
        console.error('Online reward write failed; match remains retryable', {
          raceId:race.id,error:error instanceof Error?error.name:'unknown'
        });
        this.saveRace(race);
        return;
      }
    }
    // Never checkpoint "paid" until all server-side writes have completed.
    human.lastResult = result;
    human.paid = true;
    this.saveRace(race);
    this.send(human.socket, result);
  }

  private finish(race: QuickRace): void {
    if (race.phase === 'finished') return;
    if (race.startAt !== null) this.tickBots(race);
    race.phase = 'finished';
    const elapsed = Math.max(1, Math.min(RACE_DURATION_MS, Date.now() - (race.startAt ?? Date.now())));
    for (const human of race.humans) {
      if (human.completedAt !== null) this.awardFinish(race, human);
      else {
        human.lastResult = { type: 'quick-result', raceId: race.id, place: null, coins: 0,
          wpm: wordsPerMinute(human.progress, elapsed),
          accuracy: human.strokes ? Math.round((human.strokes - human.mistakes) / human.strokes * 100) : 100,
          elapsedMs: elapsed, verified: false, standings: this.receiveSnapshot(race).players };
        this.send(human.socket, human.lastResult);
      }
    }
    this.saveRace(race);
    this.broadcast(race);
    this.stopTimers(race);
    // Keep a bounded recovery window if the last result frame was lost.
    race.deadline = setTimeout(() => this.dispose(race), QUICK_RECONNECT_GRACE_MS);
  }

  private receiveSnapshot(race: QuickRace): RoomSnapshot {
    return {
      type: 'state', mode: 'quick', matchId: race.id, serverNow: Date.now(),
      phase: race.phase, queueEndsAt: race.phase === 'waiting' ? race.queueEndsAt : null,
      startAt: race.startAt, durationMs: RACE_DURATION_MS, prompt: race.prompt,
      players: [...race.humans, ...race.bots].map(
        ({ id, name, car, trail, sticker, title, progress, mistakes, strokes, completedAt, ready, ...rest }) => ({
          id, name, car, trail, sticker, title, progress, mistakes, strokes, completedAt, ready,
          inputSeq: 'inputVersion' in rest && rest.inputVersion === 2 ? rest.inputSeq : undefined,
          inputWrong: 'inputVersion' in rest && rest.inputVersion === 2 ? rest.inputWrong : undefined,
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
    if (race.phase === 'finished') {
      // A disconnected completed racer may reconnect to retrieve the result.
      this.saveRace(race);
      this.broadcast(race);
      return;
    }
    if (race.phase === 'waiting') {
      race.humans.delete(human);
      if (race.humans.size === 0) this.dispose(race);
      else { this.saveRace(race); this.broadcast(race); }
      return;
    }
    if (human.disconnectTimer) clearTimeout(human.disconnectTimer);
    human.disconnectTimer = setTimeout(() => {
      human.disconnectTimer = null;
      if (human.socket !== null) return;
      race.humans.delete(human);
      if (race.humans.size === 0) this.dispose(race);
      else { this.saveRace(race); this.broadcast(race); }
    }, QUICK_RECONNECT_GRACE_MS);
    // Preserve race progress and the player slot during a brief network outage.
    this.saveRace(race);
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
    this.checkpoints?.forget(race.id);
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
