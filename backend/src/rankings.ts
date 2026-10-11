import { safePlayerName } from './logic';

/** Original TypeRacer weekly points — not Nitro Type's proprietary/current algorithm.
 * Points are separate from XP, level, virtual coins, and race placement.
 * No points for unfinished matches, <70% accuracy, or implausibly high speeds.
 */
export function racingPoints(wpm: number, accuracy: number, finished: boolean): number {
  if (!finished || !Number.isFinite(wpm) || !Number.isFinite(accuracy) ||
      wpm < 0 || wpm > 210 || accuracy < 70 || accuracy > 100) return 0;
  const a = accuracy / 100;
  return Math.max(0, Math.round((90 + wpm * .75) * a * a));
}

/** Cloudflare SQLite Durable Object: no new migration or external paid dependency. */
type Row = Record<string, unknown>;
type DB = Pick<SqlStorage, 'exec'>;
const first = (result: ReturnType<DB['exec']>): Row | null =>
  (result.toArray()[0] as Row | undefined) ?? null;

export class RaceRankingStore {
  constructor(private readonly sql: DB) {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_players (
      id TEXT PRIMARY KEY, guest_token TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0, races INTEGER NOT NULL DEFAULT 0,
      best_wpm INTEGER NOT NULL DEFAULT 0, total_wpm INTEGER NOT NULL DEFAULT 0,
      total_accuracy INTEGER NOT NULL DEFAULT 0, team_id TEXT,
      team_points INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_races (
      race_id TEXT NOT NULL, player_id TEXT NOT NULL, points INTEGER NOT NULL,
      wpm INTEGER NOT NULL, accuracy INTEGER NOT NULL, finished_at INTEGER NOT NULL, team_id TEXT,
      PRIMARY KEY (race_id, player_id)
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS leaderboard_races_time ON leaderboard_races(finished_at)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS leaderboard_teams (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, tag TEXT NOT NULL UNIQUE,
      join_code TEXT NOT NULL UNIQUE, captain_id TEXT NOT NULL, created_at INTEGER NOT NULL
    )`);
  }
  fromCookie(cookie: string | null): Row | null {
    const token = /(?:^|;\s*)tr_guest=([a-f0-9]{64})(?:;|$)/.exec(cookie ?? '')?.[1];
    return token ? first(this.sql.exec('SELECT * FROM leaderboard_players WHERE guest_token=?', token)) : null;
  }
  session(cookie: string | null): { player: Row; newToken?: string } {
    const previous = this.fromCookie(cookie);
    if (previous) return {player: previous};
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const id = crypto.randomUUID();
    this.sql.exec('INSERT INTO leaderboard_players(id,guest_token,name,created_at) VALUES(?,?,?,?)',
      id, token, 'Зочин-'+id.slice(0,5), Date.now());
    return { player: first(this.sql.exec('SELECT * FROM leaderboard_players WHERE id=?', id))!, newToken: token };
  }
  publicPlayer(p: Row): object {
    return {
      id:p.id, name:p.name, points:p.points, races:p.races, bestWpm:p.best_wpm,
      avgWpm: Number(p.races) ? Math.round(Number(p.total_wpm)/Number(p.races)) : 0,
      avgAccuracy: Number(p.races) ? Math.round(Number(p.total_accuracy)/Number(p.races)) : 0,
      teamId:p.team_id, guest:true
    };
  }
  rename(player: Row, name: string): Row {
    this.sql.exec('UPDATE leaderboard_players SET name=? WHERE id=?', safePlayerName(name), player.id);
    return first(this.sql.exec('SELECT * FROM leaderboard_players WHERE id=?', player.id))!;
  }
  record(raceId: string, playerId: string | null, wpm: number, accuracy: number, finishedAt: number): number {
    if (!playerId) return 0;
    const p = first(this.sql.exec('SELECT * FROM leaderboard_players WHERE id=?', playerId));
    if (!p) return 0;
    if (first(this.sql.exec('SELECT race_id FROM leaderboard_races WHERE race_id=? AND player_id=?',raceId,playerId))) return 0;
    const points = racingPoints(wpm,accuracy,true);
    if (!points) return 0;
    const safeWpm = Math.round(wpm), safeAccuracy = Math.round(accuracy);
    this.sql.exec('INSERT INTO leaderboard_races(race_id,player_id,points,wpm,accuracy,finished_at,team_id) VALUES(?,?,?,?,?,?,?)',
      raceId,playerId,points,safeWpm,safeAccuracy,finishedAt,p.team_id);
    this.sql.exec(`UPDATE leaderboard_players SET points=points+?, races=races+1,
      best_wpm=MAX(best_wpm,?), total_wpm=total_wpm+?,
      total_accuracy=total_accuracy+?, team_points=team_points+? WHERE id=?`,
      points,safeWpm,safeWpm,safeAccuracy,p.team_id?points:0,playerId);
    return points;
  }
  /** UTC Monday boundary is stable, documented, and calculated on the server. */
  static weekStart(at: number): number {
    const d = new Date(at);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate()-((day+6)%7));
    d.setUTCHours(0,0,0,0);
    return d.getTime();
  }
  leaderboard(now=Date.now(),limit=50,offset=0): object {
    const since=RaceRankingStore.weekStart(now);
    const boundedLimit=Math.max(1,Math.min(100,limit)), boundedOffset=Math.max(0,Math.min(100_000,offset));
    const total = Number(first(this.sql.exec('SELECT COUNT(DISTINCT player_id) AS total FROM leaderboard_races WHERE finished_at>=?',since))?.total ?? 0);
    const rows=this.sql.exec(`SELECT p.id,p.name,p.races,p.best_wpm,p.total_wpm,p.total_accuracy,
       t.tag AS team_tag, SUM(e.points) AS points, COUNT(*) AS week_races,
       AVG(e.wpm) AS week_wpm, AVG(e.accuracy) AS week_accuracy
       FROM leaderboard_races e JOIN leaderboard_players p ON p.id=e.player_id
       LEFT JOIN leaderboard_teams t ON t.id=p.team_id
       WHERE e.finished_at>=? GROUP BY p.id
       ORDER BY points DESC,week_accuracy DESC,p.id ASC LIMIT ? OFFSET ?`,since,boundedLimit,boundedOffset).toArray();
    return {period:'week',weekStart:since,total,offset:boundedOffset,limit:boundedLimit,players:rows.map((r,i)=>({
      rank:boundedOffset+i+1,id:r.id,name:r.name,points:r.points,races:r.week_races,
      wpm:Math.round(Number(r.week_wpm)),accuracy:Math.round(Number(r.week_accuracy)),
      bestWpm:r.best_wpm,teamTag:r.team_tag,guest:true
    }))};
  }
  teams(now=Date.now()): object {
    const since=RaceRankingStore.weekStart(now);
    const rows=this.sql.exec(`SELECT t.id,t.name,t.tag,COUNT(DISTINCT p.id) AS members,
       COALESCE(SUM(e.points),0) AS points,COUNT(e.race_id) AS races
       FROM leaderboard_teams t LEFT JOIN leaderboard_players p ON p.team_id=t.id
       LEFT JOIN leaderboard_races e ON e.team_id=t.id AND e.player_id=p.id AND e.finished_at>=?
       GROUP BY t.id ORDER BY points DESC,t.id ASC LIMIT 100`,since).toArray();
    return {period:'week',weekStart:since,teams:rows.map((r,i)=>({...r,rank:i+1}))};
  }
  createTeam(player: Row, rawName: string, rawTag: string): {error?: string;team?:Row} {
    const name=safePlayerName(rawName);
    const tag=rawTag.trim().toUpperCase();
    if (!/^([A-Z0-9]{2,5})$/.test(tag) || name.length<3 || name.length>20)
      return {error:'Багийн нэр 3–20, tag 2–5 латин үсэг/тоо байх ёстой.'};
    if (player.team_id) return {error:'Эхлээд өмнөх багаасаа гарах шаардлагатай.'};
    if (first(this.sql.exec('SELECT id FROM leaderboard_teams WHERE tag=?',tag)))
      return {error:'Энэ tag аль хэдийн ашиглагдаж байна.'};
    const id=crypto.randomUUID(), code=crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
    this.sql.exec('INSERT INTO leaderboard_teams(id,name,tag,join_code,captain_id,created_at) VALUES(?,?,?,?,?,?)',
      id,name,tag,code,player.id,Date.now());
    this.sql.exec('UPDATE leaderboard_players SET team_id=?, team_points=0 WHERE id=?',id,player.id);
    return {team:first(this.sql.exec('SELECT * FROM leaderboard_teams WHERE id=?',id))!};
  }
  joinTeam(player: Row, code: string): {error?: string;team?:Row} {
    if (player.team_id) return {error:'Өөр багт харьяалагдаж байна.'};
    if (!/^[A-F0-9]{8}$/.test(code)) return {error:'8 тэмдэгттэй код оруулна уу.'};
    const team=first(this.sql.exec('SELECT * FROM leaderboard_teams WHERE join_code=?',code));
    if (!team) return {error:'Баг олдсонгүй.'};
    const count=first(this.sql.exec('SELECT COUNT(*) AS total FROM leaderboard_players WHERE team_id=?',team.id));
    if (Number(count?.total)>=25) return {error:'Баг дүүрсэн.'};
    this.sql.exec('UPDATE leaderboard_players SET team_id=?,team_points=0 WHERE id=?',team.id,player.id);
    return {team};
  }
  leaveTeam(player: Row): boolean {
    if (!player.team_id) return false;
    const team=first(this.sql.exec('SELECT * FROM leaderboard_teams WHERE id=?',player.team_id));
    if (team?.captain_id===player.id) return false;
    this.sql.exec('UPDATE leaderboard_players SET team_id=NULL,team_points=0 WHERE id=?',player.id);
    return true;
  }
  myTeam(player: Row): object|null {
    if (!player.team_id) return null;
    const team=first(this.sql.exec('SELECT * FROM leaderboard_teams WHERE id=?',player.team_id));
    if (!team) return null;
    const members=this.sql.exec('SELECT id,name,races,best_wpm,team_points FROM leaderboard_players WHERE team_id=? ORDER BY team_points DESC LIMIT 25',team.id).toArray();
    return {id:team.id,name:team.name,tag:team.tag,captainId:team.captain_id,
      joinCode:team.captain_id===player.id?team.join_code:undefined,
      members:members.map(m=>({id:m.id,name:m.name,races:m.races,bestWpm:m.best_wpm,points:m.team_points}))};
  }
}
