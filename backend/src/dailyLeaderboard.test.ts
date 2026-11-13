import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {RaceRankingStore} from './rankings';
import {EarnedProgressionStore,earnedXp} from './earned';

const databases:DatabaseSync[]=[];
function fixture(){
  const db=new DatabaseSync(':memory:');databases.push(db);
  const sql={exec(query:string,...values:unknown[]){
    const upper=query.trim().toUpperCase();
    if(upper.startsWith('CREATE ')){db.exec(query);return {toArray:()=>[]};}
    const stmt=db.prepare(query);
    const args=values as Array<string|number|null>;
    if(upper.startsWith('SELECT '))return {toArray:()=>stmt.all(...args)};
    stmt.run(...args);return {toArray:()=>[]};
  }};
  const store=sql as unknown as Pick<SqlStorage,'exec'>;
  return {db,rank:new RaceRankingStore(store),earned:new EarnedProgressionStore(store)};
}
afterEach(()=>{for(const db of databases.splice(0))db.close();});
const dayStart=Date.parse('2026-11-12T16:00:00Z'); // Nov 13 00:00 Ulaanbaatar
const now=dayStart+2*60*60_000;
const id=(n:number)=>'11111111-1111-4111-8111-'+n.toString(16).padStart(12,'0');
const event=(n:number,playerId:string,finishedAt=now,wpm=80,accuracy=95)=>({
  raceId:id(n),playerId,place:1,coins:30,wpm,accuracy,finishedAt
});
describe('daily online beta standings',()=>{
  it('uses only verified finished race ledger, never local XP, resets at Mongolia midnight',async()=>{
    const {rank,earned}=fixture();
    const a=await rank.session(null),b=await rank.session(null);
    const alice=String(a.player.id),bob=String(b.player.id);
    earned.creditRace(event(1,alice,dayStart-1000));
    earned.creditRace(event(2,alice,now,70,95));
    earned.creditRace(event(3,alice,now+1000,80,95));
    earned.creditRace(event(4,bob,now+2000,140,97));
    expect(earned.creditRace(event(4,bob,now+2000,140,97)).awarded).toBe(false);
    const daily=earned.dailyLeaderboard(now+3000);
    expect(daily).toMatchObject({period:'day',mode:'daily',day:'2026-11-13',
      nextResetAt:dayStart+86_400_000,total:2,offset:0,limit:20});
    expect(daily.players.map(x=>x.id)).toEqual([alice,bob]);
    expect(daily.players[0]).toMatchObject({rank:1,id:alice,races:2,
      points:earnedXp(70,95)+earnedXp(80,95),bestWpm:80,guest:true});
    expect(daily.players[1]).toMatchObject({rank:2,id:bob,races:1,
      points:earnedXp(140,97),bestWpm:140,guest:true});
    expect(earned.dailyLeaderboard(dayStart-1).players.map(x=>x.id)).toEqual([alice]);
    expect(earned.dailyLeaderboard(dayStart+86_400_000).total).toBe(0);
  });
  it('respects top-50/offset bounds, correct guest/linked status and does not expose sessions',async()=>{
    const {db,rank,earned}=fixture();
    const a=await rank.session(null),b=await rank.session(null);
    const alice=String(a.player.id),bob=String(b.player.id);
    db.prepare('INSERT INTO leaderboard_identities(provider,provider_id,player_id) VALUES(?,?,?)')
      .run('google','verified-subject',alice);
    earned.creditRace(event(10,alice));
    earned.creditRace(event(11,bob));
    const first=earned.dailyLeaderboard(now,1,0);
    const second=earned.dailyLeaderboard(now,1,1);
    expect(first).toMatchObject({total:2,limit:1,offset:0});
    expect(second).toMatchObject({total:2,limit:1,offset:1});
    expect([first.players[0].rank,second.players[0].rank]).toEqual([1,2]);
    const all=[...first.players,...second.players];
    expect(all.find(x=>x.id===alice)?.guest).toBe(false);
    expect(all.find(x=>x.id===bob)?.guest).toBe(true);
    expect(JSON.stringify(all)).not.toContain(String(a.newToken));
    expect(earned.dailyLeaderboard(now,500,0).limit).toBe(50);
    expect(earned.dailyLeaderboard(now,20,10_000).offset).toBe(500);
  });
});
