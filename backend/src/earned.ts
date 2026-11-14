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
const DAY_MS=86_400_000;
const MONGOLIA_OFFSET=8*3_600_000;
/** The day boundary follows Ulaanbaatar (UTC+08) independently of Worker timezone. */
export function earnedDayKey(at=Date.now()):string {
  return new Date(at+MONGOLIA_OFFSET).toISOString().slice(0,10);
}
export const ONLINE_SEASON_TIERS=[350,850,1650,2800,4200,5900,8000,10500] as const;
export type OnlineSeasonDescriptor={id:string;number:number;name:string;from:number;until:number};
/** One season every two calendar months beginning 2026-10-01 in Mongolia.
 * Dynamic calendar arithmetic means 2027+ does not require a redeploy.
 */
export function onlineSeasonAt(at=Date.now()):OnlineSeasonDescriptor {
  const local=new Date(at+MONGOLIA_OFFSET);
  const months=(local.getUTCFullYear()-2026)*12+local.getUTCMonth()-9;
  const index=Math.max(0,Math.floor(months/2));
  const number=index+1;
  const from=Date.UTC(2026,9+index*2,1)-MONGOLIA_OFFSET;
  const until=Date.UTC(2026,11+index*2,1)-MONGOLIA_OFFSET;
  const name=number===1?'ЭХНИЙ ГАРАА':number===2?'ӨВЛИЙН ГАРАА':'ШИНЭ ГАРАА';
  return {id:'season-'+String(number).padStart(2,'0'),number,name,from,until};
}
const seasonCars=[
  ['falcon','midnight','dragon'],
  ['nomad','streak','aurora-x'],
  ['rover','ghost','royal'],
  ['sunflare','onyx','eagle'],
  ['dune','meteor','nebula']
] as const;
export function onlineSeasonRewards(number:number){
  const pool=seasonCars[Math.max(0,number-2)%seasonCars.length];
  const sticker=number%2===0?'bolt':'horse';
  const trail=['ice','ember','steppe'][(number-2+3)%3];
  return ONLINE_SEASON_TIERS.map((xp,i)=>{
    const itemKey=i===1?'sticker:'+sticker:i===2?'car:'+pool[0]:
      i===4?'trail:'+trail:i===5?'title:swift':
      i===6?'car:'+pool[1]:i===7?'car:'+pool[2]:null;
    const item=itemKey?SHOP.find(x=>x.kind+':'+x.id===itemKey):null;
    return {tier:i+1,xp,coins:i===0?120:i===3?350:0,
      itemKey,name:item?.name??(i===0?'120 зоос':'350 зоос')};
  });
}
export const ONLINE_DAILY_QUESTS=[
  {id:'first-finish',name:'Эхний бариа',detail:'Өнөөдөр нэг онлайн уралдаан дуусгах',target:1,coins:8},
  {id:'precision',name:'Нямбай жолооч',detail:'95%-ийн нарийвчлалтай 3 онлайн уралдаан дуусгах',target:3,coins:12},
  {id:'speed',name:'Хурдны сорилт',detail:'70 WPM-ээс хурдан 5 онлайн уралдаан дуусгах',target:5,coins:15}
] as const;
const SEASON_START=Date.parse('2026-10-01T00:00:00+08:00');
const SEASON_END=Date.parse('2026-12-01T00:00:00+08:00');

/** Same eligibility boundary for the server ledger and the race result sent to
 * the browser. Ineligible finishes must not claim coins that are never credited.
 */
export function earnedRaceMetricsEligible(wpm:number,accuracy:number):boolean {
  return Number.isFinite(wpm) && wpm>=0 && wpm<=210 &&
    Number.isFinite(accuracy) && accuracy>=70 && accuracy<=100;
}
export function earnedXp(wpm:number,accuracy:number):number {
  return Math.max(25,Math.min(160,Math.round(wpm*.6+accuracy*.45)));
}
export class EarnedProgressionStore {
  constructor(private sql:SQL, private atomic:<T>(fn:()=>T)=>T=fn=>fn()) {
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_profiles(
      player_id TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0,
      coins INTEGER NOT NULL DEFAULT 200, races INTEGER NOT NULL DEFAULT 0,
      season_xp INTEGER NOT NULL DEFAULT 0,
      car TEXT NOT NULL DEFAULT 'sunset',
      trail TEXT NOT NULL DEFAULT 'none',
      title TEXT NOT NULL DEFAULT 'rookie',
      sticker TEXT NOT NULL DEFAULT 'none')`);
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_races(
      race_id TEXT NOT NULL, player_id TEXT NOT NULL, xp INTEGER NOT NULL,
      coins INTEGER NOT NULL, season_xp INTEGER NOT NULL,
      wpm INTEGER NOT NULL, accuracy INTEGER NOT NULL, finished_at INTEGER NOT NULL,
      PRIMARY KEY(race_id,player_id))`);
    sql.exec('CREATE INDEX IF NOT EXISTS earned_races_player_time ON earned_races(player_id,finished_at)');
    sql.exec('CREATE INDEX IF NOT EXISTS earned_races_time ON earned_races(finished_at)');
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_quest_claims(
      player_id TEXT NOT NULL, day TEXT NOT NULL, quest_id TEXT NOT NULL,
      coins INTEGER NOT NULL, claimed_at INTEGER NOT NULL,
      PRIMARY KEY(player_id,day,quest_id))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS earned_season_claims(
      player_id TEXT NOT NULL, season_id TEXT NOT NULL, tier INTEGER NOT NULL,
      coins INTEGER NOT NULL, item_key TEXT, claimed_at INTEGER NOT NULL,
      PRIMARY KEY(player_id,season_id,tier))`);
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
        +COALESCE((SELECT SUM(coins) FROM earned_quest_claims WHERE player_id=?),0)
        +COALESCE((SELECT SUM(coins) FROM earned_season_claims WHERE player_id=?),0)
        -COALESCE((SELECT SUM(cost) FROM earned_items WHERE player_id=?),0))
      WHERE player_id=?`,id,id,id,EARNED_STARTER_COINS,id,id,id,id,id);
  }
  /** Public, beta daily standings from the SAME verified race-event ledger
   * used for spendable online XP. Device-local practice never enters this list.
   */
  dailyLeaderboard(at=Date.now(),limit=20,offset=0) {
    const day=earnedDayKey(at);
    const start=Date.parse(day+'T00:00:00Z')-MONGOLIA_OFFSET;
    const take=Number.isFinite(limit)?Math.max(1,Math.min(50,Math.floor(limit))):20;
    const skip=Number.isFinite(offset)?Math.max(0,Math.min(500,Math.floor(offset))):0;
    const total=Number(first(this.sql,`SELECT COUNT(DISTINCT e.player_id) AS n
      FROM earned_races e JOIN leaderboard_players p ON p.id=e.player_id
      WHERE e.finished_at>=? AND e.finished_at<?`,start,start+DAY_MS)?.n??0);
    const rows=this.sql.exec(`SELECT p.id,p.name,t.tag AS team_tag,
      COUNT(*) AS races,SUM(e.xp) AS points,
      MAX(e.wpm) AS best_wpm,AVG(e.wpm) AS avg_wpm,
      AVG(e.accuracy) AS avg_accuracy,
      EXISTS(SELECT 1 FROM leaderboard_identities i WHERE i.player_id=p.id) AS verified
      FROM earned_races e JOIN leaderboard_players p ON p.id=e.player_id
      LEFT JOIN leaderboard_teams t ON t.id=p.team_id
      WHERE e.finished_at>=? AND e.finished_at<?
      GROUP BY p.id ORDER BY points DESC,avg_accuracy DESC,p.id ASC LIMIT ? OFFSET ?`,
      start,start+DAY_MS,take,skip).toArray();
    return {period:'day' as const,mode:'daily' as const,day,nextResetAt:start+DAY_MS,
      total,offset:skip,limit:take,players:rows.map((row,i)=>({
        rank:skip+i+1,id:String(row.id),name:String(row.name),points:Number(row.points),
        races:Number(row.races),wpm:Math.round(Number(row.avg_wpm)),
        accuracy:Math.round(Number(row.avg_accuracy)),bestWpm:Number(row.best_wpm),
        teamTag:row.team_tag==null?null:String(row.team_tag),guest:Number(row.verified)===0
      }))};
  }
  daily(id:string,at=Date.now()) {
    this.ensure(id);
    const day=earnedDayKey(at);
    const start=Date.parse(day+'T00:00:00Z')-MONGOLIA_OFFSET;
    const stats=first(this.sql,`SELECT COUNT(*) finished,
      COALESCE(SUM(CASE WHEN accuracy>=95 THEN 1 ELSE 0 END),0) precision,
      COALESCE(SUM(CASE WHEN wpm>=70 THEN 1 ELSE 0 END),0) speed
      FROM earned_races
      WHERE player_id=? AND finished_at>=? AND finished_at<?`,
      id,start,start+DAY_MS)!;
    const claimed=new Set(this.sql.exec(
      'SELECT quest_id FROM earned_quest_claims WHERE player_id=? AND day=?',
      id,day).toArray().map(x=>String(x.quest_id)));
    const values:Record<string,number>={
      'first-finish':Number(stats.finished),precision:Number(stats.precision),speed:Number(stats.speed)
    };
    return {day,quests:ONLINE_DAILY_QUESTS.map(quest=>{
      const progress=Math.min(quest.target,values[quest.id]??0);
      return {...quest,progress,done:progress>=quest.target,claimed:claimed.has(quest.id)};
    })};
  }
  claimDaily(id:string,questId:string,at=Date.now()) {
    return this.atomic(()=>{
      const selected=ONLINE_DAILY_QUESTS.find(q=>q.id===questId);
      if(!selected)return {error:'invalid_quest'};
      const daily=this.daily(id,at);
      const state=daily.quests.find(q=>q.id===questId)!;
      if(state.claimed)return {error:'already_claimed'};
      if(!state.done)return {error:'not_complete'};
      this.sql.exec('INSERT INTO earned_quest_claims(player_id,day,quest_id,coins,claimed_at) VALUES(?,?,?,?,?)',
        id,daily.day,questId,selected.coins,at);
      this.reconcile(id);
      return {profile:this.overview(id,at)};
    });
  }
  season(id:string,at=Date.now()) {
    this.ensure(id);
    const active=onlineSeasonAt(at);
    const total=first(this.sql,
      'SELECT COALESCE(SUM(xp),0) amount FROM earned_races WHERE player_id=? AND finished_at>=? AND finished_at<?',
      id,active.from,active.until)!;
    const xp=Number(total.amount);
    const claimed=new Set(this.sql.exec(
      'SELECT tier FROM earned_season_claims WHERE player_id=? AND season_id=?',
      id,active.id).toArray().map(row=>Number(row.tier)));
    return {...active,xp,remainingDays:Math.max(0,Math.ceil((active.until-at)/DAY_MS)),
      rewards:onlineSeasonRewards(active.number).map(reward=>({...reward,
        claimed:claimed.has(reward.tier),
        claimable:active.number>=2 && xp>=reward.xp && !claimed.has(reward.tier)
      }))};
  }
  claimSeason(id:string,tier:number,at=Date.now()) {
    return this.atomic(()=>{
      const season=this.season(id,at);
      if(season.number<2)return {error:'legacy_season'};
      const reward=season.rewards.find(q=>q.tier===tier);
      if(!reward)return {error:'invalid_tier'};
      if(reward.claimed)return {error:'already_claimed'};
      if(!reward.claimable)return {error:'not_complete'};
      let coins=reward.coins;
      let itemKey=reward.itemKey;
      if(itemKey){
        const alreadyOwned=first(this.sql,
          'SELECT item_key FROM earned_items WHERE player_id=? AND item_key=?',id,itemKey);
        if(alreadyOwned) {
          const catalog=SHOP.find(item=>item.kind+':'+item.id===itemKey);
          coins=Math.round((catalog?.price??0)/2);
          itemKey=null;
        } else {
          this.sql.exec('INSERT OR IGNORE INTO earned_items(player_id,item_key,cost,purchased_at) VALUES(?,?,?,?)',
            id,itemKey,0,at);
        }
      }
      this.sql.exec('INSERT INTO earned_season_claims(player_id,season_id,tier,coins,item_key,claimed_at) VALUES(?,?,?,?,?,?)',
        id,season.id,tier,coins,itemKey,at);
      this.reconcile(id);
      return {profile:this.overview(id,at)};
    });
  }
  overview(id:string,at=Date.now()) {
    this.ensure(id);
    const player=first(this.sql,'SELECT * FROM earned_profiles WHERE player_id=?',id)!;
    const owned=this.sql.exec('SELECT item_key FROM earned_items WHERE player_id=? ORDER BY purchased_at DESC',id)
      .toArray().map(row=>String(row.item_key));
    const recent=this.sql.exec(`SELECT race_id,xp,coins,wpm,accuracy,finished_at
      FROM earned_races WHERE player_id=? ORDER BY finished_at DESC LIMIT 20`,id).toArray()
      .map(row=>({raceId:row.race_id,xp:row.xp,coins:row.coins,wpm:row.wpm,
        accuracy:row.accuracy,finishedAt:row.finished_at}));
    const season=this.season(id,at);
    const raceStats=first(this.sql,`SELECT COALESCE(MAX(wpm),0) AS best_wpm,
      COALESCE(ROUND(AVG(wpm)),0) AS avg_wpm,
      COALESCE(ROUND(AVG(accuracy)),0) AS avg_accuracy,
      MAX(finished_at) AS last_raced_at
      FROM earned_races WHERE player_id=?`,id)!;
    const stats={bestWpm:Number(raceStats.best_wpm),avgWpm:Number(raceStats.avg_wpm),
      avgAccuracy:Number(raceStats.avg_accuracy),
      lastRacedAt:raceStats.last_raced_at===null?null:Number(raceStats.last_raced_at)};
    return {xp:Number(player.xp),coins:Number(player.coins),races:Number(player.races),stats,
      seasonXp:season.xp,season,level:Math.floor(Number(player.xp)/300)+1,
      owned,recent,daily:this.daily(id,at),source:'server' as const,starter:EARNED_STARTER_COINS,
      equipped:{car:String(player.car),trail:String(player.trail),
        title:String(player.title),sticker:String(player.sticker)}};
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
        !earnedRaceMetricsEligible(wpm,accuracy) ||
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
  equip(id:string,kind:string,itemId:string) {
    return this.atomic(()=>{
      if (!['car','trail','title','sticker'].includes(kind)) return {error:'invalid_item'};
      const defaults:Record<string,string>={car:'sunset',trail:'none',title:'rookie',sticker:'none'};
      if (itemId!==defaults[kind] && !SHOP.some(x=>x.kind===kind && x.id===itemId))
        return {error:'invalid_item'};
      const state=this.overview(id);
      if (itemId!==defaults[kind]&&!state.owned.includes(kind+':'+itemId))
        return {error:'not_owned'};
      // Table column is selected only from the allowlist, never from raw request.
      this.sql.exec('UPDATE earned_profiles SET '+kind+'=? WHERE player_id=?',itemId,id);
      return {profile:this.overview(id)};
    });
  }
  /** OAuth merges identities only after trusted provider exchange. Drop duplicate
   * race/item events and grant the 200-coin starter allowance just once.
   */
  mergeAccount(from:string,to:string,inTransaction=false) {
    if (from===to)return;
    const merge=()=>{
      const source=first(this.sql,'SELECT player_id FROM earned_profiles WHERE player_id=?',from);
      if (!source)return;
      this.ensure(to);
      this.sql.exec(`INSERT OR IGNORE INTO earned_races(
        race_id,player_id,xp,coins,season_xp,wpm,accuracy,finished_at)
        SELECT race_id,?,xp,coins,season_xp,wpm,accuracy,finished_at
        FROM earned_races WHERE player_id=?`,to,from);
      this.sql.exec(`INSERT OR IGNORE INTO earned_items(player_id,item_key,cost,purchased_at)
        SELECT ?,item_key,cost,purchased_at FROM earned_items WHERE player_id=?`,to,from);
      const fromEquipment=first(this.sql,'SELECT car,trail,title,sticker FROM earned_profiles WHERE player_id=?',from);
      if (fromEquipment) for (const [kind,defaultId] of Object.entries(
        {car:'sunset',trail:'none',title:'rookie',sticker:'none'})) {
        const selected=String(fromEquipment[kind]??defaultId);
        if (selected!==defaultId &&
            first(this.sql,'SELECT item_key FROM earned_items WHERE player_id=? AND item_key=?',
              to,kind+':'+selected))
          this.sql.exec('UPDATE earned_profiles SET '+kind+'=? WHERE player_id=? AND '+kind+'=?',
            selected,to,defaultId);
      }
      this.sql.exec(`INSERT OR IGNORE INTO earned_quest_claims(player_id,day,quest_id,coins,claimed_at)
        SELECT ?,day,quest_id,coins,claimed_at FROM earned_quest_claims WHERE player_id=?`,to,from);
      this.sql.exec('DELETE FROM earned_quest_claims WHERE player_id=?',from);
      this.sql.exec(`INSERT OR IGNORE INTO earned_season_claims(
        player_id,season_id,tier,coins,item_key,claimed_at)
        SELECT ?,season_id,tier,coins,item_key,claimed_at
        FROM earned_season_claims WHERE player_id=?`,to,from);
      this.sql.exec('DELETE FROM earned_season_claims WHERE player_id=?',from);
      this.sql.exec('DELETE FROM earned_races WHERE player_id=?',from);
      this.sql.exec('DELETE FROM earned_items WHERE player_id=?',from);
      this.sql.exec('DELETE FROM earned_profiles WHERE player_id=?',from);
      this.reconcile(to);
    };
    if (inTransaction) merge();
    else this.atomic(merge);
  }
}
