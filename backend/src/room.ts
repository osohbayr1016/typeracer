import {
  choosePrompt, characters, ROOM_CAPACITY, RACE_DURATION_MS,
  type Racer, type RoomSnapshot, wordsPerMinute
} from '@typeracer/shared';
import { acceptKeystroke, safePlayerName } from './logic';

type Message = { type: 'ready' } | { type: 'key'; key: string };
type Player = Racer & { socket: WebSocket; windowStart: number; windowCount: number };
type Phase = RoomSnapshot['phase'];

export class RaceRoom {
  private sockets = new Map<WebSocket, Player>();
  private prompt = choosePrompt('mn');
  private phase: Phase = 'waiting';
  private startAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(_state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }
    if (this.phase !== 'waiting' || this.sockets.size >= ROOM_CAPACITY) {
      return new Response('Room is busy or full', { status: 409 });
    }
    const url = new URL(request.url);
    const name = safePlayerName(url.searchParams.get('name') || '');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const player: Player = {
      id: crypto.randomUUID(), name, progress: 0, mistakes: 0, strokes: 0,
      ready: false, completedAt: null, socket: server,
      windowStart: 0, windowCount: 0
    };
    server.accept();
    this.sockets.set(server, player);
    server.addEventListener('message', (event: MessageEvent) => this.receive(player, event.data));
    server.addEventListener('close', () => this.leave(server));
    server.addEventListener('error', () => this.leave(server));
    this.send(server, { type: 'welcome', id: player.id });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  private snapshot(): RoomSnapshot {
    return {
      type: 'state', phase: this.phase, prompt: this.prompt,
      players: [...this.sockets.values()].map(({ id, name, progress, mistakes, strokes, ready, completedAt }) =>
        ({ id, name, progress, mistakes, strokes, ready, completedAt })),
      startAt: this.startAt, durationMs: RACE_DURATION_MS
    };
  }

  private send(socket: WebSocket, value: unknown): void {
    try { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
    catch { this.leave(socket); }
  }
  private broadcast(): void {
    const state = this.snapshot();
    for (const socket of this.sockets.keys()) this.send(socket, state);
  }
  private leave(socket: WebSocket): void {
    if (!this.sockets.delete(socket)) return;
    if (this.sockets.size === 0 && this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.sockets.size === 0 && this.phase !== 'waiting') {
      this.phase = 'finished';
    }
    this.broadcast();
  }
  private receive(player: Player, data: unknown): void {
    if (typeof data !== 'string' || data.length > 160) return;
    let message: Message;
    try { message = JSON.parse(data) as Message; } catch { return; }
    if (message.type === 'ready' && this.phase === 'waiting') {
      player.ready = true;
      if (this.sockets.size >= 2 && [...this.sockets.values()].every(p => p.ready)) {
        this.phase = 'countdown';
        this.startAt = Date.now() + 3_000;
        this.timer = setTimeout(() => {
          if (this.phase !== 'countdown') return;
          this.phase = 'racing';
          this.broadcast();
          this.timer = setTimeout(() => this.finish(), RACE_DURATION_MS);
        }, 3_000);
      }
      this.broadcast();
      return;
    }
    if (message.type !== 'key' || this.phase !== 'racing' || player.completedAt !== null ||
        this.startAt === null || Date.now() < this.startAt) return;
    const now = Date.now();
    if (now - player.windowStart >= 1_000) { player.windowStart = now; player.windowCount = 0; }
    if (++player.windowCount > 35) return; // per-socket flood guard; additional edge limits required
    const next = acceptKeystroke(this.prompt.text, player.progress, player.mistakes, player.strokes, message.key);
    if (next.strokes === player.strokes) return;
    player.progress = next.progress;
    player.mistakes = next.mistakes;
    player.strokes = next.strokes;
    if (player.progress === characters(this.prompt.text).length) player.completedAt = now;
    this.broadcast();
    if ([...this.sockets.values()].every(p => p.completedAt !== null)) this.finish();
  }
  private finish(): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.broadcast();
    const start = this.startAt || Date.now();
    for (const player of this.sockets.values()) {
      this.send(player.socket, {
        type: 'result',
        wpm: wordsPerMinute(player.progress, (player.completedAt || Date.now()) - start),
        verified: false
      });
    }
  }
}
