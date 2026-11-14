import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {EarnedProgressionStore,EARNED_STARTER_COINS,earnedXp,earnedDayKey} from './earned';

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
    expect(store.equip('shopper','title','supporter')).toEqual({error:'not_owned'});
    expect(store.equip('shopper','title','not-a-title')).toEqual({error:'invalid_item'});
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

describe('authoritative daily missions — Mongolia timezone and coin integrity',()=>{
  const now=Date.parse('2026-11-12T11:00:00Z'); // 19:00 Ulaanbaatar
  const id=(i:number)=>'00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');
  it('uses Ulaanbaatar midnight and does not roll previous-day eligibility forward',()=>{
    expect(earnedDayKey(Date.parse('2026-11-12T15:59:59Z'))).toBe('2026-11-12');
    expect(earnedDayKey(Date.parse('2026-11-12T16:00:00Z'))).toBe('2026-11-13');
    const {store}=fixture();
    store.creditRace({...match(A,'tester'),finishedAt:now});
    expect(store.daily('tester',now).quests[0]).toMatchObject({progress:1,done:true,claimed:false});
    expect(store.daily('tester',Date.parse('2026-11-12T16:00:00Z')).quests[0])
      .toMatchObject({progress:0,done:false,claimed:false});
    expect(store.claimDaily('tester','first-finish',Date.parse('2026-11-12T16:00:00Z')))
      .toEqual({error:'not_complete'});
    const claimed=store.claimDaily('tester','first-finish',now);
    expect(claimed).toMatchObject({profile:{coins:238,daily:{day:'2026-11-12'}}});
    expect(store.daily('tester',now).quests[0].claimed).toBe(true);
    expect(store.daily('tester',Date.parse('2026-11-12T16:00:00Z')).quests[0].claimed).toBe(false);
  });
  it('requires real server races; each of the three free goals pays exactly once',()=>{
    const {db,store}=fixture();
    expect(store.claimDaily('runner','first-finish',now)).toEqual({error:'not_complete'});
    expect(store.claimDaily('runner','spoofed',now)).toEqual({error:'invalid_quest'});
    for(let n=1;n<=5;n++){
      expect(store.creditRace({...match(id(n),'runner'),finishedAt:now+n*2000}).awarded).toBe(true);
    }
    const board=store.daily('runner',now).quests;
    expect(board.map(q=>q.progress)).toEqual([1,3,5]);
    expect(board.every(q=>q.done&&!q.claimed)).toBe(true);
    for(const key of ['first-finish','precision','speed']){
      const result=store.claimDaily('runner',key,now);
      expect(result).toHaveProperty('profile');
      expect(store.claimDaily('runner',key,now)).toEqual({error:'already_claimed'});
    }
    expect(store.overview('runner',now)).toMatchObject({races:5,coins:200+5*30+8+12+15});
    expect(db.prepare('SELECT COUNT(*) n FROM earned_quest_claims').get()?.n).toBe(3);
  });
  it('rolls back partially written quest claims, then permits one clean retry',()=>{
    const {db,store,fail}=fixture();
    store.creditRace({...match(A,'rollback'),finishedAt:now});
    fail('UPDATE earned_profiles SET');
    expect(()=>store.claimDaily('rollback','first-finish',now)).toThrow('injected SQL failure');
    expect(db.prepare('SELECT COUNT(*) n FROM earned_quest_claims').get()?.n).toBe(0);
    fail('');
    expect(store.claimDaily('rollback','first-finish',now))
      .toMatchObject({profile:{coins:200+30+8}});
    expect(store.claimDaily('rollback','first-finish',now)).toEqual({error:'already_claimed'});
  });
  it('deduplicates guest and linked-user claims for the same day on OAuth merge',()=>{
    const {db,store}=fixture();
    store.creditRace({...match(A,'guest'),finishedAt:now});
    store.creditRace({...match(B,'linked'),finishedAt:now+1000});
    expect(store.claimDaily('guest','first-finish',now)).toHaveProperty('profile');
    expect(store.claimDaily('linked','first-finish',now)).toHaveProperty('profile');
    store.mergeAccount('guest','linked');
    expect(store.overview('linked',now)).toMatchObject({races:2,coins:200+60+8});
    expect(db.prepare('SELECT COUNT(*) n FROM earned_quest_claims WHERE player_id=?').get('linked')?.n).toBe(1);
    expect(store.claimDaily('linked','first-finish',now)).toEqual({error:'already_claimed'});
    store.mergeAccount('guest','linked');
    expect(store.overview('linked',now).coins).toBe(268);
  });
});
