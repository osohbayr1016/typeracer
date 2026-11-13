import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { RaceRankingStore, racingPoints } from './rankings';

const databases:DatabaseSync[]=[];
function fixture(){
  const db=new DatabaseSync(':memory:');databases.push(db);
  const sql={
    exec(query:string,...values:unknown[]){
      const normalized=query.trim().toUpperCase();
      if(normalized.startsWith('CREATE ')){db.exec(query);return {toArray:()=>[]};}
      const stmt=db.prepare(query);
      const args=values as Array<string|number|null>;
      if(normalized.startsWith('SELECT '))return {toArray:()=>stmt.all(...args)};
      stmt.run(...args);return {toArray:()=>[]};
    }
  };
  return {db,sql,store:new RaceRankingStore(sql as unknown as Pick<SqlStorage,'exec'>)};
}
afterEach(()=>{for(const db of databases.splice(0))db.close();});
describe('beta human-v-human leaderboard isolation',()=>{
  it('counts PvP only when the server certifies a real human opponent at the green light',async()=>{
    const {db,store}=fixture();
    const alice=await store.session(null);
    const bob=await store.session(null);
    const now=Date.now();
    const id1=String(alice.player.id),id2=String(bob.player.id);
    expect(store.record('solo-only',id1,80,95,now,false)).toBe(racingPoints(80,95,true));
    const pvpPoints=racingPoints(95,99,true);
    expect(store.record('two-humans',id1,95,99,now,true)).toBe(pvpPoints);
    expect(store.record('two-humans',id2,68,91,now,true)).toBeGreaterThan(0);
    const all=store.leaderboard(now,50,0,'all') as {mode:string;players:Array<{id:string;points:number;races:number}>};
    const pvp=store.leaderboard(now,50,0,'pvp') as {mode:string;players:Array<{id:string;points:number;races:number}>};
    expect(all.mode).toBe('all');
    expect(pvp.mode).toBe('pvp');
    expect(all.players.find(row=>row.id===id1)).toMatchObject({
      points:racingPoints(80,95,true)+pvpPoints,races:2
    });
    expect(pvp.players.find(row=>row.id===id1)).toMatchObject({points:pvpPoints,races:1});
    expect(db.prepare('SELECT COUNT(*) AS n FROM leaderboard_pvp_races').get()?.n).toBe(2);
    expect(store.record('two-humans',id1,95,99,now,true)).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM leaderboard_pvp_races').get()?.n).toBe(2);
  });
  it('starts empty after additive migration: old casual races are not mislabelled human PvP',async()=>{
    const {sql,store}=fixture();
    const alice=await store.session(null);
    store.record('legacy-casual',String(alice.player.id),70,90,Date.now());
    const rebooted=new RaceRankingStore(sql as unknown as Pick<SqlStorage,'exec'>);
    const pvp=rebooted.leaderboard(Date.now(),10,0,'pvp') as {total:number;players:unknown[]};
    expect(pvp.total).toBe(0);
    expect(pvp.players).toEqual([]);
    expect((rebooted.leaderboard() as {total:number}).total).toBe(1);
  });
});
