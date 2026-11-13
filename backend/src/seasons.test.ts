import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {EarnedProgressionStore,onlineSeasonAt,onlineSeasonRewards,earnedXp} from './earned';
const opened:DatabaseSync[]=[];
function fixture(){
  const db=new DatabaseSync(':memory:');opened.push(db);
  let fail='';
  const sql={exec(q:string,...v:unknown[]){
    if(fail && q.includes(fail))throw Error('injected write failure');
    const stmt=db.prepare(q);const args=v as Array<string|number|null>;
    if(q.trim().toUpperCase().startsWith('SELECT '))return {toArray:()=>stmt.all(...args)};
    stmt.run(...args);return {toArray:()=>[]};
  }};
  const atomic=<T>(fn:()=>T):T=>{
    db.exec('BEGIN IMMEDIATE');
    try{const value=fn();db.exec('COMMIT');return value;}
    catch(e){db.exec('ROLLBACK');throw e;}
  };
  return {db,store:new EarnedProgressionStore(sql as unknown as Pick<SqlStorage,'exec'>,atomic),
    fail:(q:string)=>{fail=q}};
}
afterEach(()=>{for(const d of opened.splice(0))d.close();});
const start=Date.parse('2026-11-30T16:00:00Z');
const match=(n:number,playerId='alice',at=start+60_000)=>({
  raceId:'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0'),
  playerId,place:1,coins:30,wpm:80,accuracy:95,finishedAt:at+n*1000
});
describe('automatic server seasons — Ulaanbaatar calendar',()=>{
  it('rolls from Season 01 to 02 at exactly midnight and into 03 in February',()=>{
    const before=onlineSeasonAt(start-1),season2=onlineSeasonAt(start);
    expect(before).toMatchObject({id:'season-01',number:1,until:start});
    expect(season2).toMatchObject({id:'season-02',number:2,from:start,
      until:Date.parse('2027-01-31T16:00:00Z')});
    expect(onlineSeasonAt(season2.until)).toMatchObject({
      id:'season-03',number:3,from:season2.until});
    expect(onlineSeasonAt(Date.parse('2027-12-01T00:00:00Z')).number).toBeGreaterThan(3);
    expect(onlineSeasonRewards(2)).toHaveLength(8);
    expect(onlineSeasonRewards(2).map(r=>r.xp))
      .toEqual([350,850,1650,2800,4200,5900,8000,10500]);
  });
  it('counts only finished online races inside the current two-month season',()=>{
    const {store}=fixture();
    store.creditRace(match(1,'alice',start-70_000));
    const initial=store.season('alice',start);
    expect(initial.xp).toBe(0);
    store.creditRace(match(2,'alice',start+1000));
    const second=store.season('alice',start+100000);
    expect(second.xp).toBe(earnedXp(80,95));
    expect(second.rewards[0]).toMatchObject({claimable:false,claimed:false});
    expect(store.claimSeason('alice',1,start+100000)).toEqual({error:'not_complete'});
    expect(store.claimSeason('alice',1,start-1)).toEqual({error:'legacy_season'});
    expect(store.claimSeason('alice',99,start+100000)).toEqual({error:'invalid_tier'});
  });
  it('requires server-verified XP, grants coins or actual cosmetics and prevents duplicate claims',()=>{
    const {db,store}=fixture();
    for(let n=1;n<=10;n++)store.creditRace(match(n,'alice'));
    expect(store.season('alice',start+60_000).rewards.slice(0,2).every(x=>x.claimable)).toBe(true);
    const coins=store.claimSeason('alice',1,start+60_000);
    expect(coins).toMatchObject({profile:{coins:200+10*30+120}});
    expect(store.claimSeason('alice',1,start+60_000)).toEqual({error:'already_claimed'});
    const item=store.claimSeason('alice',2,start+60_000);
    expect(item).toMatchObject({profile:{owned:['sticker:bolt']}});
    expect(db.prepare('SELECT cost FROM earned_items WHERE player_id=? AND item_key=?')
      .get('alice','sticker:bolt')?.cost).toBe(0);
    expect(store.equip('alice','sticker','bolt')).toMatchObject({
      profile:{equipped:{sticker:'bolt'}}
    });
    const view=store.season('alice',start+60_000);
    expect(view.rewards[0]).toMatchObject({claimed:true,claimable:false});
    expect(view.rewards[1]).toMatchObject({claimed:true,claimable:false});
  });
  it('compensates for a pre-owned item and keeps payouts additive',()=>{
    const {store}=fixture();
    for(let n=1;n<=10;n++)store.creditRace(match(n,'alice'));
    // A purchased sticker must not be re-granted as a duplicate paid asset.
    expect(store.buy('alice','sticker','bolt')).toHaveProperty('profile');
    const before=store.overview('alice',start+60_000).coins;
    const claim=store.claimSeason('alice',2,start+60_000);
    expect(claim).toMatchObject({profile:{coins:before+110}});
    expect(store.overview('alice',start+60_000).owned.filter(x=>x==='sticker:bolt')).toHaveLength(1);
  });
  it('rolls back partial season grants and retries safely',()=>{
    const {db,store,fail}=fixture();
    for(let n=1;n<=4;n++)store.creditRace(match(n,'alice'));
    expect(store.season('alice',start+60_000).xp).toBeGreaterThanOrEqual(350);
    fail('UPDATE earned_profiles SET');
    expect(()=>store.claimSeason('alice',1,start+60_000)).toThrow('injected write failure');
    expect(db.prepare('SELECT COUNT(*) n FROM earned_season_claims').get()?.n).toBe(0);
    fail('');
    expect(store.claimSeason('alice',1,start+60_000)).toHaveProperty('profile');
    expect(store.claimSeason('alice',1,start+60_000)).toEqual({error:'already_claimed'});
  });
  it('merges one linked-account claim without multiplying payouts or starter grants',()=>{
    const {db,store}=fixture();
    for(let n=1;n<=4;n++)store.creditRace(match(n,'guest'));
    for(let n=5;n<=8;n++)store.creditRace(match(n,'linked'));
    store.claimSeason('guest',1,start+60_000);
    store.claimSeason('linked',1,start+60_000);
    store.mergeAccount('guest','linked');
    expect(store.overview('linked',start+60_000)).toMatchObject({
      coins:200+8*30+120,races:8
    });
    expect(db.prepare('SELECT COUNT(*) n FROM earned_season_claims WHERE player_id=?')
      .get('linked')?.n).toBe(1);
    expect(store.claimSeason('linked',1,start+60_000)).toEqual({error:'already_claimed'});
    const next=store.season('linked',Date.parse('2027-01-31T16:00:00Z'));
    expect(next).toMatchObject({number:3,xp:0});
    expect(next.rewards.some(x=>x.claimed)).toBe(false);
  });
});
