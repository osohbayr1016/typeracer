import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {EarnedProgressionStore,earnedXp} from './earned';

const opened:DatabaseSync[]=[];
function fixture(){
  const db=new DatabaseSync(':memory:');opened.push(db);
  const sql={exec(query:string,...args:unknown[]){
    const stmt=db.prepare(query),vals=args as Array<string|number|null>;
    if(query.trim().toUpperCase().startsWith('SELECT '))return {toArray:()=>stmt.all(...vals)};
    stmt.run(...vals);return {toArray:()=>[]};
  }} as unknown as Pick<SqlStorage,'exec'>;
  return {db,sql,store:new EarnedProgressionStore(sql)};
}
afterEach(()=>{for(const db of opened.splice(0))db.close();});
const event=(id:string,playerId:string,wpm:number,accuracy:number,finishedAt:number)=>({
  raceId:id,playerId,place:1,coins:30,wpm,accuracy,finishedAt
});
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
describe('cross-device authoritative online profile history',()=>{
  it('computes exact server best/averages from all accepted races even after a store restart',()=>{
    const {sql,store}=fixture();
    expect(store.overview('guest').stats).toMatchObject({
      bestWpm:0,avgWpm:0,avgAccuracy:0,lastRacedAt:null
    });
    const now=Date.parse('2026-11-13T05:00:00Z');
    expect(store.creditRace(event(A,'guest',60,95,now)).awarded).toBe(true);
    expect(store.creditRace(event(B,'guest',120,99,now+10000)).awarded).toBe(true);
    expect(store.creditRace(event(B,'guest',120,99,now+10000)).awarded).toBe(false);
    const a=store.overview('guest');
    expect(a.stats).toMatchObject({bestWpm:120,avgWpm:90,avgAccuracy:97,
      lastRacedAt:now+10000});
    expect(a).toMatchObject({races:2,xp:earnedXp(60,95)+earnedXp(120,99)});
    expect(a.recent.map(q=>q.raceId)).toEqual([B,A]);
    const restarted=new EarnedProgressionStore(sql);
    expect(restarted.overview('guest').stats).toEqual(a.stats);
    expect(restarted.overview('guest').recent).toEqual(a.recent);
  });
  it('preserves summary and race history after trusted account linking without double events',()=>{
    const {store}=fixture();
    const now=Date.parse('2026-11-13T06:00:00Z');
    store.creditRace(event(A,'guest',80,95,now));
    store.creditRace(event(B,'account',100,97,now+5000));
    store.creditRace(event(C,'guest',120,99,now+10000));
    store.mergeAccount('guest','account');
    expect(store.overview('account').stats).toMatchObject({
      bestWpm:120,avgWpm:100,avgAccuracy:97,lastRacedAt:now+10000
    });
    expect(store.overview('account').recent).toHaveLength(3);
    expect(store.overview('account').races).toBe(3);
    store.mergeAccount('guest','account');
    expect(store.overview('account').races).toBe(3);
  });
});
