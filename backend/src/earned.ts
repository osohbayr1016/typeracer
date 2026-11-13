import { SHOP } from '@typeracer/shared';

/** Source-of-truth for online rewards. Device-local practice rewards are NOT imported.
 * This prevents arbitrary localStorage balances from becoming transferable items.
 * All mutations are synchronously transactional inside the Cloudflare SQLite DO.
 */
type Row = Record<string, unknown>;
type SQL = Pick<SqlStorage, 'exec'>;
const first = (sql:SQL,query:string,...values:(string|number)[]) =>
  sql.exec(query,...values).toArray()[0] as Row | undefined;
export const EARNED_STARTER_COINS=200;
const SEASON_START=Date.parse('2026-10-01T00:00:00+08:00');
const SEASON_END=Date.parse('2026-12-01T00:00:00+08:00');

export function earnedXp(wpm:number,accuracy:number):number {
  return Math.max(25,Math.min(160,Math.round(wpm*.6+accuracy*.45)));
}
export class EarnedProgressionStore {
  constructor(private sql:SQL, private atomic:<T>(fn:()=>T)=>T=fn=>fn()) {
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_profiles(
      player_id TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 200, races INTEGER NOT NULL DEFAULT 0,
      season_xp INTEGER NOT NULL DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_races(
      race_id TEXT NOT NULL, player_id TEXT NOT NULL, xp INTEGER NOT NULL,
      coins INTEGER NOT NULL, season_xp INTEGER NOT NULL,
      wpm INTEGER NOT NULL, accuracy INTEGER NOT NULL, finished_at INTEGER NOT NULL,
      PRIMARY KEY(race_id,player_id))`);
    sql.exec('CREATE INDEX IF NOT EXISTS earned_races_player_time ON earned_races(player_id,finished_at)');
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_items(
      player_id TEXT NOT NULL, item_key TEXT NOT NULL, cost INTEGER NOT NULL,
      purchased_at INTEGER NOT NULL, PRIMARY KEY(player_id,item_key))`);
  }
  private ensure(id:string) {
    this.sql.exec('INSERT OR IGNORE INTO earned_profiles(player_id) VALUES(?)',id);
  }
  /** Rebuild from immutable server-written events and debits, not a client balance. */
  private reconcile(id:string) {
    this.sql.exec(`UPDATE earned_profiles SET
      xp=COALESCE((SELECT SUM(xp) FROM earned_races WHERE player_id=?),0),
      races=COALESCE((SELECT COUNT(*) FROM earned_races WHERE player_id=?),0),
      season_xp=COALESCE((SELECT SUM(season_xp) FROM earned_races WHERE player_id=?),0),
      coins=MAX(0,?+COALESCE((SELECT SUM(coins) FROM earned_races WHERE player_id=?),0)
        -COALESCE((SELECT SUM(cost) FROM earned_items WHERE player_id=?),0))
      WHERE player_id=?`,id,id,id,EARNED_STARTER_COINS,id,id,id);
  }
  overview(id:string) {
    this.ensure(id);
    const player=first(this.sql,'SELECT * FROM earned_profiles WHERE player_id=?',id)!;
    const owned=this.sql.exec('SELECT item_key FROM earned_items WHERE player_id=? ORDER BY purchased_at DESC',id)
      .toArray().map(row=>String(row.item_key));
    const recent=this.sql.exec(`SELECT race_id,xp,coins,wpm,accuracy,finished_at
      FROM earned_races WHERE player_id=? ORDER BY finished_at DESC LIMIT 20`,id).toArray()
      .map(row=>({raceId:row.race_id,xp:row.xp,coins:row.coins,wpm:row.wpm,
        accuracy:row.accuracy,finishedAt:row.finished_at}));
    return {xp:Number(player.xp),coins:Number(player.coins),races:Number(player.races),
      seasonXp:Number(player.season_xp),level:Math.floor(Number(player.xp)/300)+1,
      owned,recent,source:'server' as const,starter:EARNED_STARTER_COINS};
  }
  /** Only QuickMatchmaker calls this after an authoritative finished race.
   * Duplicate delivery, Worker retries and restarts cannot award the same race twice.
   */
  creditRace(input:{raceId:string;playerId:string;place:number;coins:number;
    wpm:number;accuracy:number;finishedAt:number}) {
    const {raceId,playerId,place,coins,wpm,accuracy,finishedAt}=input;
    if (!/^[a-f0-9-]{36}$/i.test(raceId) || !playerId ||
        !Number.isInteger(place) || place<1 || place>5 ||
        !Number.isInteger(coins) || coins<0 || coins>30 ||
        !Number.isFinite(wpm) || wpm<0 || wpm>210 ||
        !Number.isFinite(accuracy) || accuracy<70 || accuracy>100 ||
        !Number.isFinite(finishedAt)) return {awarded:false,xp:0,coins:0};
    return this.atomic(()=>{
      this.ensure(playerId);
      if (first(this.sql,'SELECT race_id FROM earned_races WHERE race_id=? AND player_id=?',raceId,playerId))
        return {awarded:false,xp:0,coins:0};
      const xp=earnedXp(wpm,accuracy);
      const seasonXp=finishedAt>=SEASON_START && finishedAt<SEASON_END ? xp : 0;
      this.sql.exec(`INSERT INTO earned_races(
        race_id,player_id,xp,coins,season_xp,wpm,accuracy,finished_at)
        VALUES(?,?,?,?,?,?,?,?)`,raceId,playerId,xp,coins,seasonXp,Math.round(wpm),Math.round(accuracy),finishedAt);
      this.reconcile(playerId);
      return {awarded:true,xp,coins};
    });
  }
  buy(id:string,kind:string,itemId:string) {
    return this.atomic(()=>{
      const item=SHOP.find(x=>x.kind===kind&&x.id===itemId);
      if (!item) return {error:'not_found'};
      const state=this.overview(id);
      const key=item.kind+':'+item.id;
      if (state.owned.includes(key))return {error:'already_owned'};
      if (state.level<(item.minLevel??1))return {error:'level_required'};
      if (state.coins<item.price)return {error:'insufficient_earned_coins'};
      this.sql.exec('INSERT INTO earned_items(player_id,item_key,cost,purchased_at) VALUES(?,?,?,?)',
        id,key,item.price,Date.now());
      this.reconcile(id);
      return {profile:this.overview(id)};
    });
  }
  /** OAuth merges identities only after trusted provider exchange. Drop duplicate
   * race/item events and grant the 200-coin starter allowance just once.
   */
  mergeAccount(from:string,to:string) {
    if (from===to)return;
    this.atomic(()=>{
      const source=first(this.sql,'SELECT player_id FROM earned_profiles WHERE player_id=?',from);
      if (!source)return;
      this.ensure(to);
      this.sql.exec(`INSERT OR IGNORE INTO earned_races(
        race_id,player_id,xp,coins,season_xp,wpm,accuracy,finished_at)
        SELECT race_id,?,xp,coins,season_xp,wpm,accuracy,finished_at
        FROM earned_races WHERE player_id=?`,to,from);
      this.sql.exec(`INSERT OR IGNORE INTO earned_items(player_id,item_key,cost,purchased_at)
        SELECT ?,item_key,cost,purchased_at FROM earned_items WHERE player_id=?`,to,from);
      this.sql.exec('DELETE FROM earned_races WHERE player_id=?',from);
      this.sql.exec('DELETE FROM earned_items WHERE player_id=?',from);
      this.sql.exec('DELETE FROM earned_profiles WHERE player_id=?',from);
      this.reconcile(to);
    });
  }
}
