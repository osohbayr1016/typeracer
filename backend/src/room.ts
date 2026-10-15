import {
  choosePrompt, characters, ROOM_CAPACITY, RACE_DURATION_MS, START_COUNTDOWN_MS, PROMPTS,
  type Racer, type RoomSnapshot, wordsPerMinute
} from '@typeracer/shared';
import { acceptKeystroke, safePlayerName } from './logic';
import { QuickMatchmaker } from './quick';

type Message = { type: 'ready' } | { type: 'key'; key: string } | { type: 'rematch'; matchId: string };
type Player = Racer & { socket: WebSocket; windowStart: number; windowCount: number };
type Phase = RoomSnapshot['phase'];
const CAR_IDS = ['mint','sunset','purple','lime','phantom','steppe','thunder','midnight','khan','dawn','cosmic', 'falcon', 'nomad', 'rover', 'sunflare', 'dune', 'cobalt', 'glacier', 'fox', 'streak', 'ghost', 'onyx', 'meteor', 'temple', 'nebula', 'eagle', 'royal', 'aurora-x', 'dragon'] as const;
const TRAIL_IDS = ['none','ember','steppe','ice','aurora'] as const;
const STICKER_IDS = ['none','horse','bolt','star'] as const;
const TITLE_IDS = ['rookie','swift','khan','legend'] as const;
function safeCosmetic(value: string | null, allowed: readonly string[], fallback: string) {
  return value && allowed.includes(value) ? value : fallback;
}

export class RaceRoom {
  private quick: QuickMatchmaker | null = null;
  private quickService(): QuickMatchmaker {
    return this.quick ??= new QuickMatchmaker(this.state.storage);
  }
  private sockets = new Map<WebSocket, Player>();
  private prompt = choosePrompt('mn');
  private phase: Phase = 'waiting';
  private startAt: number | null = null;
  private matchId = crypto.randomUUID();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingBroadcast: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly state: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/quickplay') return this.quickService().fetch(request);
    if (path.startsWith('/ranking/') || path.startsWith('/oauth/') || path.startsWith('/account')) {
      const rank = this.quickService().rankings!;
      const cookie = request.headers.get('Cookie');
      if (path === '/account' && request.method === 'GET') {
        const {player,newToken} = await rank.session(cookie);
        const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control':'no-store' });
        if (newToken) {
          const secure = new URL(request.url).searchParams.get('secure') === '1';
          headers.append('Set-Cookie', 'tr_guest='+newToken+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'+(secure?'; Secure':''));
        }
        return new Response(JSON.stringify({player:rank.publicPlayer(player)}), {headers});
      }
      if (path === '/account/logout' && request.method === 'POST') {
        const out=await rank.logout(cookie);
        const secure=new URL(request.url).searchParams.get('secure')==='1';
        const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
        headers.append('Set-Cookie','tr_guest='+out.newToken+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'+(secure?'; Secure':''));
        return new Response(JSON.stringify({player:rank.publicPlayer(out.player)}),{headers});
      }
      if (path.startsWith('/oauth/') && request.method==='POST') {
        let input:Record<string,unknown>;
        try { const raw=await request.json(); if (!raw || typeof raw!=='object') throw Error('json'); input=raw as Record<string,unknown>; }
        catch { return Response.json({error:'Invalid input'},{status:400}); }
        const provider=input.provider;
        if (provider!=='google' && provider!=='facebook') return Response.json({error:'Invalid provider'},{status:400});
        if (typeof input.state!=='string') return Response.json({error:'Invalid state'},{status:400});
        if (path==='/oauth/start') {
          const ok=await rank.startOAuth(cookie,provider,input.state);
          return Response.json(ok?{ok:true}:{error:'Guest account required'},{status:ok?200:401});
        }
        if (path==='/oauth/finish') {
          if (typeof input.providerSubject!=='string' || typeof input.displayName!=='string')
            return Response.json({error:'Invalid provider profile'},{status:400});
          const result=await rank.completeOAuth(cookie,provider,input.state,input.providerSubject,input.displayName);
          if (!result) return Response.json({error:'Expired or invalid OAuth state'},{status:403});
          const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
          const secure=new URL(request.url).searchParams.get('secure')==='1';
          headers.append('Set-Cookie','tr_guest='+result.newToken+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'+(secure?'; Secure':''));
          return new Response(JSON.stringify({player:rank.publicPlayer(result.player)}),{headers});
        }
        return Response.json({error:'Unsupported OAuth action'},{status:404});
      }
      if (path === '/ranking/players' && request.method === 'GET') {
        const query = new URL(request.url).searchParams;
        const limit = Number(query.get('limit') ?? 50);
        const offset = Number(query.get('offset') ?? 0);
        return Response.json(rank.leaderboard(Date.now(),Number.isFinite(limit)?limit:50,Number.isFinite(offset)?offset:0));
      }
      if (path === '/ranking/teams' && request.method === 'GET')
        return Response.json(rank.teams(Date.now()));
      const player = await rank.fromCookie(cookie);
      if (!player) return Response.json({error:'Нэвтрэх шаардлагатай.'},{status:401});
      if (path === '/ranking/team' && request.method === 'GET')
        return Response.json({team:rank.myTeam(player)});
      if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
      if (Number(request.headers.get('Content-Length')||0)>4096)
        return new Response('Payload too large',{status:413});
      let data:Record<string,unknown>;
      try { const value=await request.json(); if (!value || typeof value!=='object') throw Error('bad'); data=value as Record<string,unknown>; }
      catch { return Response.json({error:'Invalid JSON'},{status:400}); }
      if (path === '/ranking/name') {
        if (typeof data.name!=='string') return Response.json({error:'Invalid name'},{status:400});
        const next=rank.rename(player,data.name.slice(0,80));
        return Response.json({player:rank.publicPlayer(next)});
      }
      if (path === '/ranking/team') {
        if (data.action==='create' && typeof data.name==='string' && typeof data.tag==='string') {
          const result=rank.createTeam(player,data.name,data.tag);
          return Response.json(result,{status:result.error?400:201});
        }
        if (data.action==='join' && typeof data.code==='string') {
          const result=rank.joinTeam(player,data.code.trim().toUpperCase());
          return Response.json(result,{status:result.error?400:200});
        }
        if (data.action==='leave') {
          const success=rank.leaveTeam(player);
          return Response.json(success?{ok:true}:{error:'Багийн ахлагч гарахын өмнө эрхээ шилжүүлэх шаардлагатай.'},{status:success?200:409});
        }
      }
      return Response.json({error:'Invalid action'},{status:400});
    }
    // Only an API-created room can accept players. Durable storage survives DO eviction.
    if (new URL(request.url).pathname === '/create' && request.method === 'POST') {
      await this.state.storage.put('createdAt', Date.now());
      return new Response('created', { status: 201 });
    }
    const createdAt = await this.state.storage.get<number>('createdAt');
    if (!createdAt || Date.now() - createdAt > 3_600_000) {
      return new Response('Room not found or expired', { status: 404 });
    }
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
      ready: false, completedAt: null,
      car: safeCosmetic(url.searchParams.get('car'), CAR_IDS, 'sunset'),
      trail: safeCosmetic(url.searchParams.get('trail'), TRAIL_IDS, 'none'),
      sticker: safeCosmetic(url.searchParams.get('sticker'), STICKER_IDS, 'none'),
      title: safeCosmetic(url.searchParams.get('title'), TITLE_IDS, 'rookie'),
      socket: server,
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
      type: 'state', phase: this.phase, prompt: this.prompt, matchId: this.matchId, serverNow: Date.now(),
      players: [...this.sockets.values()].map(({ id, name, progress, mistakes, strokes, ready, completedAt, car, trail, sticker, title }) =>
        ({ id, name, progress, mistakes, strokes, ready, completedAt, car, trail, sticker, title })),
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
  /** Cap fanout near 20 Hz instead of broadcasting every key to every socket. */
  private queueBroadcast(): void {
    if (this.pendingBroadcast !== null) return;
    this.pendingBroadcast = setTimeout(() => {
      this.pendingBroadcast = null;
      this.broadcast();
    }, 50);
  }
  private leave(socket: WebSocket): void {
    if (!this.sockets.delete(socket)) return;
    if (this.phase === 'countdown' && this.sockets.size < 2) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.phase = 'waiting';
      this.startAt = null;
      for (const player of this.sockets.values()) player.ready = false;
    }
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
    if (!message || typeof message !== 'object') return;
    if (message.type === 'rematch') {
      if (this.phase !== 'finished' || message.matchId !== this.matchId) return;
      const prompts = PROMPTS.mn.filter(prompt => prompt.id !== this.prompt.id);
      this.prompt = prompts[Math.floor(Math.random() * prompts.length)] ?? choosePrompt('mn');
      this.matchId = crypto.randomUUID();
      this.phase = 'waiting';
      this.startAt = null;
      for (const racer of this.sockets.values()) {
        racer.ready = racer === player;
        racer.progress = racer.mistakes = racer.strokes = 0;
        racer.completedAt = null;
        racer.windowStart = racer.windowCount = 0;
      }
      this.broadcast();
      return;
    }
    if (message.type === 'ready' && this.phase === 'waiting') {
      player.ready = true;
      if (this.sockets.size >= 2 && [...this.sockets.values()].every(p => p.ready)) {
        this.phase = 'countdown';
        this.startAt = Date.now() + START_COUNTDOWN_MS;
        this.timer = setTimeout(() => this.beginRace(), START_COUNTDOWN_MS);
      }
      this.broadcast();
      return;
    }
    if (message.type === 'key' && this.phase === 'countdown') this.beginRace();
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
    this.queueBroadcast();
    if ([...this.sockets.values()].every(p => p.completedAt !== null)) this.finish();
  }
  private beginRace(): void {
    if (this.phase !== 'countdown' || this.startAt === null) return;
    const remaining = this.startAt - Date.now();
    if (remaining > 0) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.beginRace(), remaining);
      return;
    }
    this.phase = 'racing';
    this.broadcast();
    this.timer = setTimeout(() => this.finish(), Math.max(0, this.startAt + RACE_DURATION_MS - Date.now()));
  }
  private finish(): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.pendingBroadcast) clearTimeout(this.pendingBroadcast);
    this.pendingBroadcast = null;
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
