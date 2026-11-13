import {
  generatePassage, characters, ROOM_CAPACITY, RACE_DURATION_MS, START_COUNTDOWN_MS,
  type Racer, type RoomSnapshot, wordsPerMinute
} from '@typeracer/shared';
import { acceptKeystroke, safePlayerName } from './logic';
import { QuickMatchmaker } from './quick';
import { PrivateCheckpointStore, type PrivateCheckpoint } from './privateCheckpoint';
import { PaymentService, type PaymentEnv } from './payments';

type Message = { type: 'ready' } | { type: 'key'; key: string } | { type: 'rematch'; matchId: string };
type Player = Racer & {
  socket: WebSocket | null; resumeToken: string; disconnectedAt: number | null;
  windowStart: number; windowCount: number;
};
export const PRIVATE_RECONNECT_GRACE_MS=15_000;
type Phase = RoomSnapshot['phase'];
const CAR_IDS = ['mint','sunset','purple','lime','phantom','steppe','thunder','midnight','khan','dawn','cosmic', 'falcon', 'nomad', 'rover', 'sunflare', 'dune', 'cobalt', 'glacier', 'fox', 'streak', 'ghost', 'onyx', 'meteor', 'temple', 'nebula', 'eagle', 'royal', 'aurora-x', 'dragon'] as const;
const TRAIL_IDS = ['none','ember','steppe','ice','aurora','gold'] as const;
const STICKER_IDS = ['none','horse','bolt','star','crown'] as const;
const TITLE_IDS = ['rookie','swift','khan','legend','supporter'] as const;
function safeCosmetic(value: string | null, allowed: readonly string[], fallback: string) {
  return value && allowed.includes(value) ? value : fallback;
}

export class RaceRoom {
  private quick: QuickMatchmaker | null = null;
  private quickService(): QuickMatchmaker {
    return this.quick ??= new QuickMatchmaker(this.state.storage);
  }
  private sockets = new Map<WebSocket, Player>();
  private racers = new Map<string, Player>();
  private checkpoint: PrivateCheckpointStore | null;
  private restored = false;
  private roomExpiresAt=Date.now()+3_600_000;
  private cleanupTimer: ReturnType<typeof setTimeout> | null=null;
  private prompt = generatePassage({ mode: 'story' });
  private phase: Phase = 'waiting';
  private startAt: number | null = null;
  private matchId = crypto.randomUUID();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingBroadcast: ReturnType<typeof setTimeout> | null = null;

  private payments: PaymentService | null = null;
  constructor(private readonly state: DurableObjectState, private env: PaymentEnv) {
    // The legacy unit fixture has no SQLite. Production DOs always do.
    this.checkpoint=state.storage.sql
      ? new PrivateCheckpointStore(state.storage.sql) : null;
  }

  /** Restore only serializable state, never a stale socket. Preserves original
   * match, timer and caret across a Durable Object isolate replacement.
   */
  private restorePrivate(createdAt:number):void {
    if (this.restored)return;
    this.restored=true;
    this.roomExpiresAt=createdAt+3_600_000;
    const record=this.checkpoint?.load();
    if (!record)return;
    this.prompt=record.prompt;
    this.matchId=record.matchId;
    this.phase=record.phase;
    this.startAt=record.startAt;
    for(const p of record.racers){
      this.racers.set(p.id,{...p,socket:null,disconnectedAt:Date.now()});
    }
    if (this.phase==='countdown' && this.startAt!==null)
      this.timer=setTimeout(()=>this.beginRace(),Math.max(0,this.startAt-Date.now()));
    if (this.phase==='racing' && this.startAt!==null)
      this.timer=setTimeout(()=>this.finish(),Math.max(0,this.startAt+RACE_DURATION_MS-Date.now()));
    this.scheduleCleanup();
  }
  private savePrivate():void {
    if (!this.checkpoint)return;
    const racers=[...this.racers.values()].map(({socket,...p})=>p);
    const record:PrivateCheckpoint={matchId:this.matchId,prompt:this.prompt,
      startAt:this.startAt,phase:this.phase,racers};
    this.checkpoint.save(record,this.roomExpiresAt);
  }
  /** Disconnected racers retain their positions briefly for a token-based
   * reconnect. Expire stale slots to avoid locking a lobby forever.
   */
  private scheduleCleanup():void {
    if (this.cleanupTimer!==null){clearTimeout(this.cleanupTimer);this.cleanupTimer=null;}
    const missing=[...this.racers.values()].filter(p=>p.socket===null && p.disconnectedAt!==null);
    if(!missing.length)return;
    const deadline=Math.min(...missing.map(p=>(p.disconnectedAt as number)+PRIVATE_RECONNECT_GRACE_MS));
    this.cleanupTimer=setTimeout(()=>{
      this.cleanupTimer=null;
      const now=Date.now();
      for(const p of this.racers.values()){
        if(p.socket===null && p.disconnectedAt!==null &&
            now-p.disconnectedAt>=PRIVATE_RECONNECT_GRACE_MS)this.racers.delete(p.id);
      }
      if(this.phase==='countdown'&&this.racers.size<2){
        if(this.timer)clearTimeout(this.timer);
        this.timer=null;this.phase='waiting';this.startAt=null;
        for(const p of this.racers.values())p.ready=false;
      }
      this.savePrivate();
      this.broadcast();
      this.scheduleCleanup();
    },Math.max(1,deadline-Date.now()));
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/payments/')) {
      this.payments ??= new PaymentService(this.state.storage.sql, this.quickService().rankings!, this.env);
      return this.payments.fetch(request);
    }
    if (path === '/quickplay') return this.quickService().fetch(request);
    if (path.startsWith('/progression')) {
      const service=this.quickService();
      const player=await service.rankings!.fromCookie(request.headers.get('Cookie'));
      if (!player) return Response.json({error:'session_required'},{status:401});
      const id=String(player.id);
      const earned=service.earned!;
      if (path==='/progression' && request.method==='GET')
        return Response.json(earned.overview(id),{headers:{'Cache-Control':'no-store'}});
      if ((path==='/progression/items' || path==='/progression/equip' ||
          path==='/progression/quests/claim' || path==='/progression/season/claim') && request.method==='POST') {
        let input:Record<string,unknown>;
        try {
          const raw=await request.text();
          if (raw.length>512) return Response.json({error:'payload_too_large'},{status:413});
          input=JSON.parse(raw) as Record<string,unknown>;
          if (!input || typeof input!=='object')throw Error('invalid');
        } catch {return Response.json({error:'invalid_request'},{status:400});}
        if (path==='/progression/season/claim') {
          if(!Number.isInteger(input.tier))return Response.json({error:'invalid_tier'},{status:400});
          const result=earned.claimSeason(id,input.tier as number);
          return Response.json(result,{status:'error' in result ? result.error==='already_claimed'?409:400:200});
        }
        if (typeof input.id!=='string'||(path!=='/progression/quests/claim'&&typeof input.kind!=='string'))
          return Response.json({error:'invalid_request'},{status:400});
        const result=path==='/progression/quests/claim'
          ? earned.claimDaily(id,input.id)
          : path==='/progression/items'
            ? earned.buy(id,input.kind as string,input.id)
            : earned.equip(id,input.kind as string,input.id);
        return Response.json(result,{status:'error' in result?result.error==='already_owned'?409:400:200});
      }
      return new Response('Method not allowed',{status:405});
    }
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
      if (path === '/account/recovery' && request.method === 'POST') {
        const result = await rank.createRecovery(cookie);
        return Response.json(result ?? {error:'session_required'}, {status:!result ? 401 : result.exists ? 409 : 201});
      }
      if (path === '/account/recover' && request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > 256) return Response.json({error:'invalid_recovery'}, {status:400});
        let code: unknown;
        try { code = (JSON.parse(raw) as {code?:unknown}).code; } catch { /* invalid code */ }
        const result = typeof code === 'string' ? await rank.restoreRecovery(code) : null;
        if (!result) return Response.json({error:'invalid_recovery'}, {status:400});
        const secure = new URL(request.url).searchParams.get('secure') === '1';
        return new Response(JSON.stringify({player:rank.publicPlayer(result.player)}), {headers:{
          'Content-Type':'application/json', 'Cache-Control':'no-store',
          'Set-Cookie':'tr_guest='+result.newToken+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'+(secure?'; Secure':'')
        }});
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
          this.payments ??= new PaymentService(this.state.storage.sql, rank, this.env);
          this.state.storage.transactionSync(() => {
            this.payments!.mergeAccount(result.previousPlayerId, String(result.player.id));
            this.quickService().earned!.mergeAccount(result.previousPlayerId, String(result.player.id), true);
          });
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
        return Response.json(rank.leaderboard(Date.now(),Number.isFinite(limit)?limit:50,
          Number.isFinite(offset)?offset:0,query.get('mode')==='pvp'?'pvp':'all'));
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
    this.restorePrivate(createdAt);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }
    const url = new URL(request.url);
    const candidate=url.searchParams.get('resume');
    const resumed=!!candidate && /^[a-f0-9-]{36}$/i.test(candidate) &&
      [...this.racers.values()].find(p=>p.resumeToken===candidate &&
        (p.disconnectedAt===null || Date.now()-p.disconnectedAt<PRIVATE_RECONNECT_GRACE_MS));
    if (!resumed && (this.phase!=='waiting'||this.racers.size>=ROOM_CAPACITY))
      return new Response('Room is busy or full', { status: 409 });
    const name = safePlayerName(url.searchParams.get('name') || '');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const player: Player = resumed || {
      id: crypto.randomUUID(), name, progress: 0, mistakes: 0, strokes: 0,
      ready: false, completedAt: null,
      car: safeCosmetic(url.searchParams.get('car'), CAR_IDS, 'sunset'),
      trail: safeCosmetic(url.searchParams.get('trail'), TRAIL_IDS, 'none'),
      sticker: safeCosmetic(url.searchParams.get('sticker'), STICKER_IDS, 'none'),
      title: safeCosmetic(url.searchParams.get('title'), TITLE_IDS, 'rookie'),
      resumeToken:crypto.randomUUID(),disconnectedAt:null,socket:null,
      windowStart: 0, windowCount: 0
    };
    if(player.socket){
      const stale=player.socket;
      this.sockets.delete(stale);
      try{stale.close(4000,'Session resumed');}catch{/* replaced */}
    }
    player.socket=server;
    player.disconnectedAt=null;
    server.accept();
    this.racers.set(player.id,player);
    this.sockets.set(server, player);
    server.addEventListener('message', (event: MessageEvent) => this.receive(player, event.data));
    server.addEventListener('close', () => this.leave(server));
    server.addEventListener('error', () => this.leave(server));
    this.savePrivate();
    this.scheduleCleanup();
    this.send(server, { type: 'welcome', id: player.id,
      resumeToken:player.resumeToken,resumed:!!resumed });
    this.broadcast();
    if (this.phase==='finished')this.sendResult(player);
    return new Response(null, { status: 101, webSocket: client });
  }

  private snapshot(): RoomSnapshot {
    return {
      type: 'state', phase: this.phase, prompt: this.prompt, matchId: this.matchId, serverNow: Date.now(),
      players: [...this.racers.values()].map(({ id, name, progress, mistakes, strokes, ready, completedAt,
        car, trail, sticker, title, socket }) =>
        ({ id, name, progress, mistakes, strokes, ready, completedAt, car, trail, sticker, title,
          connected:socket?.readyState===WebSocket.OPEN })),
      startAt: this.startAt, durationMs: RACE_DURATION_MS
    };
  }

  private send(socket: WebSocket, value: unknown): void {
    try { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); }
    catch { this.leave(socket); }
  }
  private broadcast(): void {
    this.savePrivate();
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
    const player=this.sockets.get(socket);
    if (!player)return;
    this.sockets.delete(socket);
    if(player.socket!==socket)return; // old socket was replaced on resume
    player.socket=null;
    player.disconnectedAt=Date.now();
    // Keep countdown/racing clocks running so a reconnect preserves the same
    // race. The slot expires after grace; a disconnected participant cannot
    // permanently occupy a lobby.
    this.broadcast();
    this.scheduleCleanup();
  }
  private receive(player: Player, data: unknown): void {
    if (typeof data !== 'string' || data.length > 160) return;
    let message: Message;
    try { message = JSON.parse(data) as Message; } catch { return; }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'rematch') {
      if (this.phase !== 'finished' || message.matchId !== this.matchId) return;
      // A rematch always gets a passage from a different story.
      this.prompt = generatePassage({ mode: 'story', exclude: this.prompt.text });
      this.matchId = crypto.randomUUID();
      this.phase = 'waiting';
      this.startAt = null;
      for (const racer of this.racers.values()) {
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
    this.savePrivate(); // accepted keystrokes survive a mid-race Worker restart
    this.queueBroadcast();
    if (this.racers.size>=2 && [...this.racers.values()].every(p => p.completedAt !== null)) this.finish();
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
    for (const player of this.racers.values())this.sendResult(player);
  }
  private sendResult(player: Player): void {
    if (!player.socket)return;
    const start=this.startAt || Date.now();
    this.send(player.socket,{
      type:'result',
      wpm:wordsPerMinute(player.progress,(player.completedAt || Date.now())-start),
      verified:false
    });
  }
}
