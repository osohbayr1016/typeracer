import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { characters } from '@typeracer/shared';
import { QuickMatchmaker } from './quick';

class FakeSocket {
  readyState=1;
  sent:Array<Record<string,unknown>>=[];
  private callbacks:Record<string,Array<(e:{data?:string})=>void>>={};
  accept() {}
  send(value:string) { if(this.readyState!==1) throw Error('closed'); this.sent.push(JSON.parse(value)); }
  addEventListener(type:string,fn:(e:{data?:string})=>void) { (this.callbacks[type]??=[]).push(fn); }
  receive(value:unknown) { for(const fn of this.callbacks.message??[]) fn({data:JSON.stringify(value)}); }
  close() { this.readyState=3; for(const fn of this.callbacks.close??[]) fn({}); }
  latest(type:string) { return this.sent.filter(v=>v.type===type).at(-1); }
}
const sockets:FakeSocket[]=[];
class FakePair {
  0=new FakeSocket();
  1=new FakeSocket();
  constructor() { sockets.push(this[1]); }
}
class FakeResponse {
  status:number;
  constructor(_body:unknown,options:{status:number}) {this.status=options.status;}
}
let db:DatabaseSync;
let storage:DurableObjectStorage;
beforeEach(()=>{
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-13T10:00:00Z'));
  sockets.length=0;
  vi.stubGlobal('WebSocketPair',FakePair);
  vi.stubGlobal('WebSocket',{OPEN:1});
  vi.stubGlobal('Response',FakeResponse);
  db=new DatabaseSync(':memory:');
  const sql={
    exec(query:string,...values:unknown[]) {
      const uppercase=query.trim().toUpperCase();
      if(uppercase.startsWith('CREATE ')) {db.exec(query);return {toArray:()=>[]};}
      const stmt=db.prepare(query);
      const params=values as Array<string|number|null>;
      if(uppercase.startsWith('SELECT '))return {toArray:()=>stmt.all(...params)};
      stmt.run(...params);return {toArray:()=>[]};
    }
  };
  storage={sql} as unknown as DurableObjectStorage;
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();db.close();});

async function enter(service:QuickMatchmaker,token?:string,cookie?:string){
  const query=new URLSearchParams({input:'2'});
  if(token)query.set('resume',token);
  const request=new Request('https://room.internal/quickplay?'+query,{
    headers:{Upgrade:'websocket',...(cookie?{Cookie:cookie}:{})}
  });
  const response=await service.fetch(request);
  expect(response.status).toBe(101);
  const socket=sockets.at(-1)!;
  return {
    socket,
    welcome:socket.latest('welcome') as {id:string;resumeToken:string;resumed:boolean},
    state:socket.latest('state') as {matchId:string;startAt:number;prompt:{text:string};players:Array<{id:string;progress:number;inputSeq:number}>}
  };
}
describe('SQLite durable quick-match crash recovery',()=>{
  it('restores match ID, input ACK sequence, bot state and accepted Cyrillic progress on fresh instance',async()=>{
    const original=new QuickMatchmaker(storage);
    const first=await enter(original);
    vi.advanceTimersByTime(6000);
    const live=first.socket.latest('state') as typeof first.state;
    const letters=characters(live.prompt.text);
    for(let index=0;index<3;index++){
      first.socket.receive({type:'key',key:letters[index],matchId:live.matchId,seq:index+1});
    }
    first.socket.close();
    // Process exit removes in-memory timers and sockets; SQLite stays alive.
    vi.clearAllTimers();
    const restored=new QuickMatchmaker(storage);
    const resumed=await enter(restored,first.welcome.resumeToken);
    expect(resumed.welcome).toMatchObject({id:first.welcome.id,resumed:true});
    expect(resumed.state.matchId).toBe(live.matchId);
    expect(resumed.state.players.find(p=>p.id===first.welcome.id)).toMatchObject({progress:3,inputSeq:3});
    const before=resumed.socket.latest('state') as typeof resumed.state;
    resumed.socket.receive({type:'key',key:letters[2],matchId:live.matchId,seq:3});
    resumed.socket.receive({type:'key',key:letters[3],matchId:live.matchId,seq:4});
    vi.advanceTimersByTime(60);
    const after=resumed.socket.latest('state') as typeof resumed.state;
    const stored=JSON.parse(String(db.prepare('SELECT payload FROM quick_checkpoints WHERE id=?')
      .get(live.matchId)?.payload)) as {phase:string;humans:Array<{inputSeq:number;progress:number}>};
    expect({phase:after.phase,storedPhase:stored.phase,storedHuman:stored.humans[0],
      latestAck:resumed.socket.latest('input-ack'),latestState:after.players.find(p=>p.id===first.welcome.id)})
      .toMatchObject({phase:'racing',storedPhase:'racing',storedHuman:{progress:4,inputSeq:4},
        latestState:{progress:4,inputSeq:4}});
    expect(after.matchId).toBe(before.matchId);
    expect(JSON.stringify(after)).not.toContain(first.welcome.resumeToken);
  });

  it('returns the exact paid-out race result after restart without awarding twice',async()=>{
    const original=new QuickMatchmaker(storage);
    const account=await original.rankings!.session(null);
    const first=await enter(original,undefined,'tr_guest='+account.newToken);
    vi.advanceTimersByTime(6000);
    const live=first.socket.latest('state') as typeof first.state;
    const letters=characters(live.prompt.text);
    for(let index=0;index<letters.length;index++){
      first.socket.receive({type:'key',key:letters[index],matchId:live.matchId,seq:index+1});
      if(index%12===11) vi.advanceTimersByTime(1000);
    }
    const completed=first.socket.latest('quick-result') as {raceId:string;place:number;wpm:number}|undefined;
    expect(completed?.raceId).toBe(live.matchId);
    expect(completed?.place).toBeGreaterThan(0);
    const count=()=>Number(db.prepare('SELECT COUNT(*) AS n FROM leaderboard_races WHERE race_id=?')
      .get(live.matchId)?.n);
    expect(count()).toBe(1);
    first.socket.close();
    vi.clearAllTimers();
    const next=new QuickMatchmaker(storage);
    const resumed=await enter(next,first.welcome.resumeToken,'tr_guest='+account.newToken);
    expect(resumed.welcome).toMatchObject({id:first.welcome.id,resumed:true});
    const recovered=resumed.socket.latest('quick-result') as {raceId:string;place:number;wpm:number}|undefined;
    expect(recovered).toMatchObject({raceId:completed!.raceId,place:completed!.place,wpm:completed!.wpm});
    expect(count()).toBe(1);
    vi.advanceTimersByTime(16000);
    const afterExpiry=await enter(new QuickMatchmaker(storage),first.welcome.resumeToken);
    expect(afterExpiry.welcome.resumed).toBe(false);
  });
});
