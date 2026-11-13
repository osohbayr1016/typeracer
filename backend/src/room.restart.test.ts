import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {characters,START_COUNTDOWN_MS,RACE_DURATION_MS,type RoomSnapshot} from '@typeracer/shared';
import {RaceRoom,PRIVATE_RECONNECT_GRACE_MS} from './room';

class FakeSocket {
  readyState=1;
  sent:Array<Record<string,unknown>>=[];
  private handlers=new Map<string,Array<(event:{data?:string})=>void>>();
  accept(){}
  addEventListener(name:string,fn:(e:{data?:string})=>void) {
    this.handlers.set(name,[...(this.handlers.get(name)||[]),fn]);
  }
  send(s:string){if(this.readyState!==1)throw Error('closed');this.sent.push(JSON.parse(s));}
  receive(value:object){for(const fn of this.handlers.get('message')||[])fn({data:JSON.stringify(value)});}
  close(){if(this.readyState===3)return;this.readyState=3;
    for(const fn of this.handlers.get('close')||[])fn({});}
  latest(type:string){return this.sent.filter(x=>x.type===type).at(-1);}
  state(){return this.latest('state') as unknown as RoomSnapshot;}
}
const servers:FakeSocket[]=[];
let db:DatabaseSync,created:number,state:DurableObjectState;
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime('2026-11-13T09:00:00Z');
  servers.length=0;created=Date.now();
  vi.stubGlobal('WebSocket',{OPEN:1});
  vi.stubGlobal('WebSocketPair',class {
    0=new FakeSocket();1=new FakeSocket();
    constructor(){servers.push(this[1]);}
  });
  vi.stubGlobal('Response',class{
    status:number;webSocket?:FakeSocket;
    constructor(_body:unknown,options:{status:number;webSocket?:FakeSocket}){
      this.status=options.status;this.webSocket=options.webSocket;
    }
  });
  db=new DatabaseSync(':memory:');
  const sql={exec(q:string,...args:unknown[]){
    const stmt=db.prepare(q);const vals=args as Array<string|number|null>;
    if(q.trim().toUpperCase().startsWith('SELECT '))return {toArray:()=>stmt.all(...vals)};
    stmt.run(...vals);return {toArray:()=>[]};
  }};
  state=({storage:{sql,get:async (key:string) => key==='createdAt' ? created : undefined}}
    as unknown as DurableObjectState);
});
afterEach(()=>{
  vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();db.close();
});
async function join(room:RaceRoom,name:string,token?:string){
  const q=new URLSearchParams({name});if(token)q.set('resume',token);
  const result=await room.fetch(new Request('https://room.internal/ws?'+q,{
    headers:{Upgrade:'websocket'}
  })) as Response;
  expect(result.status).toBe(101);
  const socket=servers.at(-1)!;
  return {socket,welcome:socket.latest('welcome') as {id:string;resumeToken:string;resumed:boolean},
    snapshot:socket.state()};
}
function crash(){
  const at=Date.now();vi.clearAllTimers();vi.setSystemTime(at);
}
describe('durable private room reconnect/restart',()=>{
  it('persists room ID, passage, real Unicode progress and player cosmetics through a DO restart',async()=>{
    const room=new RaceRoom(state,{});
    const one=await join(room,'Өлзий'),two=await join(room,'Наран');
    const id=one.snapshot.matchId!;
    one.socket.receive({type:'ready'});two.socket.receive({type:'ready'});
    vi.advanceTimersByTime(START_COUNTDOWN_MS);
    expect(one.socket.state().phase).toBe('racing');
    const text=characters(one.socket.state().prompt.text);
    for(const letter of text.slice(0,3))one.socket.receive({type:'key',key:letter});
    vi.advanceTimersByTime(51);
    const typed=one.socket.state().players.find(p=>p.id===one.welcome.id);
    expect(typed?.progress).toBe(3);
    one.socket.close();two.socket.close();crash();
    const restored=new RaceRoom(state,{});
    const back=await join(restored,'Өлзий',one.welcome.resumeToken);
    const opponent=await join(restored,'Наран',two.welcome.resumeToken);
    expect(back.welcome).toMatchObject({id:one.welcome.id,resumed:true});
    expect(opponent.welcome).toMatchObject({id:two.welcome.id,resumed:true});
    expect(back.socket.state()).toMatchObject({matchId:id,phase:'racing',prompt:one.snapshot.prompt});
    expect(back.socket.state().players.find(p=>p.id===one.welcome.id)?.progress).toBe(3);
    expect(JSON.stringify(back.socket.state())).not.toContain(one.welcome.resumeToken);
    expect(JSON.stringify(back.socket.state())).not.toContain(two.welcome.resumeToken);
    back.socket.receive({type:'key',key:text[3]});
    vi.advanceTimersByTime(52);
    expect(opponent.socket.state().players.find(p=>p.id===one.welcome.id)?.progress).toBe(4);
    const saved=JSON.parse(String(db.prepare(
      'SELECT payload FROM private_room_checkpoint WHERE slot=1').get()?.payload));
    expect(saved).toMatchObject({matchId:id,phase:'racing'});
    expect(saved.racers.find((p:{id:string})=>p.id===one.welcome.id).progress).toBe(4);
  });
  it('does not allow a guessed bearer to join an in-progress race or steal a slot',async()=>{
    const room=new RaceRoom(state,{});
    const one=await join(room,'First'),two=await join(room,'Second');
    one.socket.receive({type:'ready'});two.socket.receive({type:'ready'});
    vi.advanceTimersByTime(START_COUNTDOWN_MS+10);
    const response=await room.fetch(new Request(
      'https://room.internal/ws?name=Thief&resume=ffffffff-ffff-4fff-8fff-ffffffffffff',
      {headers:{Upgrade:'websocket'}}));
    expect(response.status).toBe(409);
    expect(one.socket.state().players).toHaveLength(2);
    const resumed=await join(room,'First',one.welcome.resumeToken);
    expect(resumed.welcome).toMatchObject({id:one.welcome.id,resumed:true});
    expect(resumed.socket.state().players).toHaveLength(2);
    expect(one.socket.readyState).toBe(3);
  });
  it('evicts stale disconnected lobby slots after grace and never leaks old identity',async()=>{
    const room=new RaceRoom(state,{});
    const one=await join(room,'First'),two=await join(room,'Second');
    one.socket.close();
    expect(two.socket.state().players.find(p=>p.id===one.welcome.id)?.connected).toBe(false);
    vi.advanceTimersByTime(PRIVATE_RECONNECT_GRACE_MS+1);
    expect(two.socket.state().players).toHaveLength(1);
    const next=await join(room,'New',one.welcome.resumeToken);
    expect(next.welcome.resumed).toBe(false);
    expect(next.welcome.id).not.toBe(one.welcome.id);
  });
  it('keeps completed private match results after reload without duplicating a new match',async()=>{
    const room=new RaceRoom(state,{});
    const one=await join(room,'First'),two=await join(room,'Second');
    one.socket.receive({type:'ready'});two.socket.receive({type:'ready'});
    vi.advanceTimersByTime(START_COUNTDOWN_MS+RACE_DURATION_MS+1);
    const result=one.socket.latest('result');
    expect(result).toMatchObject({type:'result',verified:false});
    expect(one.socket.state().phase).toBe('finished');
    const id=one.socket.state().matchId;
    one.socket.close();two.socket.close();crash();
    const restored=new RaceRoom(state,{});
    const back=await join(restored,'First',one.welcome.resumeToken);
    expect(back.socket.state()).toMatchObject({phase:'finished',matchId:id});
    expect(back.socket.latest('result')).toEqual(result);
  });
});
