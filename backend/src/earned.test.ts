import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {EarnedProgressionStore,EARNED_STARTER_COINS,earnedXp} from './earned';

const databases:DatabaseSync[]=[];
function fixture(){
  const db=new DatabaseSync(':memory:'); databases.push(db);
  let failOn='';
  const sql={exec(query:string,...values:unknown[]){
    if(failOn && query.includes(failOn))throw Error('injected SQL failure');
    const stmt=db.prepare(query);
    const args=values as Array<string|number|null>;
    if(query.trim().toUpperCase().startsWith('SELECT ')||query.trim().toUpperCase().startsWith('PRAGMA '))
      return {toArray:()=>stmt.all(...args)};
    stmt.run(...args);return {toArray:()=>[]};
  }};
  const atomic=<T>(fn:()=>T):T=>{
    db.exec('BEGIN IMMEDIATE');
    try{const out=fn();db.exec('COMMIT');return out;}
    catch(e){db.exec('ROLLBACK');throw e;}
  };
  const store=new EarnedProgressionStore(sql as unknown as Pick<SqlStorage,'exec'>,atomic);
  return {db,store,atomic,fail:(value:string)=>{failOn=value}};
}
afterEach(()=>{for(const db of databases.splice(0))db.close();});
const match=(raceId:string,playerId:string,coins=30,wpm=80)=>({
  raceId,playerId,place:1,coins,wpm,accuracy:95,finishedAt:Date.parse('2026-11-12T10:00:00Z')
});
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',
  C='33333333-3333-4333-8333-333333333333';
describe('server-owned free online economy',()=>{
  it('starts with one server-owned allowance and idempotently records completed races',()=>{
    const {db,store}=fixture();
    expect(store.overview('alice')).toMatchObject({xp:0,coins:EARNED_STARTER_COINS,races:0,source:'server'});
    expect(store.creditRace(match(A,'alice'))).toEqual({awarded:true,xp:earnedXp(80,95),coins:30});
    expect(store.creditRace(match(A,'alice'))).toEqual({awarded:false,xp:0,coins:0});
    const profile=store.overview('alice');
    expect(profile).toMatchObject({coins:230,races:1,xp:earnedXp(80,95),seasonXp:earnedXp(80,95)});
    expect(profile.recent).toHaveLength(1);
    expect(db.prepare('SELECT COUNT(*) n FROM earned_races').get()?.n).toBe(1);
    // Reinitializing a DO keeps its ledger intact.
    const sql={exec(query:string,...args:unknown[]){
      const stmt=db.prepare(query);const params=args as Array<string|number|null>;
      return query.trim().startsWith('SELECT ')?
        {toArray:()=>stmt.all(...params)}:(stmt.run(...params),{toArray:()=>[]});
    }};
    const reloaded=new EarnedProgressionStore(sql as unknown as Pick<SqlStorage,'exec'>);
    expect(reloaded.overview('alice').xp).toBe(profile.xp);
  });
  it('refuses untrusted result values and browser-controlled award attempts',()=>{
    const {store}=fixture();
    expect(store.creditRace({...match(A,'a'),wpm:500}).awarded).toBe(false);
    expect(store.creditRace({...match(A,'a'),accuracy:60}).awarded).toBe(false);
    expect(store.creditRace({...match(A,'a'),raceId:'forged'}).awarded).toBe(false);
    expect(store.creditRace({...match(A,'a'),coins:1000}).awarded).toBe(false);
    expect(store.overview('a')).toMatchObject({coins:200,races:0});
  });
  it('spends only server-owned earned coins on actual shop catalog items',()=>{
    const {store}=fixture();
    expect(store.buy('shopper','title','swift')).toMatchObject({profile:{coins:10,owned:['title:swift']}});
    expect(store.buy('shopper','title','swift')).toEqual({error:'already_owned'});
    expect(store.equip('shopper','title','swift')).toMatchObject({profile:{equipped:{title:'swift'}}});
    expect(store.equip('shopper','title','rookie')).toMatchObject({profile:{equipped:{title:'rookie'}}});
    expect(store.equip('shopper','car','dragon')).toEqual({error:'not_owned'});
    expect(store.equip('shopper','title','supporter')).toEqual({error:'invalid_item'});
    expect(store.equip('shopper','__proto__','swift')).toEqual({error:'invalid_item'});
    expect(store.buy('shopper','car','dragon')).toEqual({error:'level_required'});
    expect(store.buy('shopper','car','falcon')).toEqual({error:'insufficient_earned_coins'});
    expect(store.buy('shopper','title','not-a-real-item')).toEqual({error:'not_found'});
  });
  it('recovers a partial SQL write via rollback and exact once retry',()=>{
    const {store,db,fail}=fixture();
    fail('UPDATE earned_profiles SET');
    expect(()=>store.creditRace(match(A,'alice'))).toThrow('injected SQL failure');
    expect(db.prepare('SELECT COUNT(*) n FROM earned_races').get()?.n).toBe(0);
    fail('');
    expect(store.creditRace(match(A,'alice')).awarded).toBe(true);
    expect(store.creditRace(match(A,'alice')).awarded).toBe(false);
    expect(store.overview('alice')).toMatchObject({coins:230,races:1});
  });
  it('merges guest accounts after OAuth without multiplying starter coins or duplicate events',()=>{
    const {store}=fixture();
    store.creditRace(match(A,'guest',18));
    store.creditRace(match(B,'target',30));
    store.creditRace(match(C,'guest',20));
    store.buy('guest','title','swift');
    store.equip('guest','title','swift');
    expect(store.overview('guest').coins).toBe(200+18+20-190);
    store.mergeAccount('guest','target');
    const merged=store.overview('target');
    expect(merged).toMatchObject({coins:200+18+20+30-190,races:3,owned:['title:swift'],
      equipped:{title:'swift'}});
    expect(merged.recent).toHaveLength(3);
    store.mergeAccount('guest','target');
    expect(store.overview('target').coins).toBe(merged.coins);
  });
});
