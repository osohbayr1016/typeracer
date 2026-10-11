import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { RaceRankingStore, SESSION_TTL_MS, sessionDigest } from './rankings';

// Real in-memory SQLite (Node 22 built-in). Runs the actual DO SQL statements
// rather than source-text assertions or a hand-coded fake database.
const databases: DatabaseSync[] = [];
function fixture() {
  const db = new DatabaseSync(':memory:');
  databases.push(db);
  const sql = {exec(query: string, ...values: unknown[]) {
    const params = values as Array<string | number | bigint | null>;
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('CREATE ')) {
      db.exec(query);
      return {toArray: () => []};
    }
    const statement = db.prepare(query);
    if (trimmed.startsWith('SELECT ')) {
      const rows = statement.all(...params);
      return {toArray: () => rows};
    }
    statement.run(...params);
    return {toArray: () => []};
  }};
  const store = new RaceRankingStore(sql as unknown as Pick<SqlStorage, 'exec'>);
  return {db, store};
}
const cookie = (token: string) => 'tr_guest=' + token;
const state = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
afterEach(() => {for(const db of databases.splice(0)) db.close();});

describe('SQLite-backed independent player sessions', () => {
  it('creates opaque device cookies but persists only SHA-256 session digests', async () => {
    const {db,store} = fixture();
    const first = await store.session(null);
    expect(first.newToken).toMatch(/^[a-f0-9]{64}$/);
    expect(await store.session(cookie(first.newToken!))).toMatchObject({
      player:{id:first.player.id}
    });
    const sessions = db.prepare('SELECT token_hash,player_id,expires_at FROM leaderboard_sessions').all();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).toBe(await sessionDigest(first.newToken!));
    expect(sessions[0].token_hash).not.toBe(first.newToken);
    expect(Number(sessions[0].expires_at) - Date.now()).toBeGreaterThan(SESSION_TTL_MS - 10_000);
    expect(db.prepare('SELECT guest_token FROM leaderboard_players WHERE id=?').get(first.player.id as string)?.guest_token)
      .not.toBe(first.newToken);
  });
  it('Google re-login on another device keeps first device signed in; logout only revokes current device', async () => {
    const {db,store} = fixture();
    const browserA = await store.session(null);
    expect(await store.startOAuth(cookie(browserA.newToken!),'google',state)).toBe(true);
    const loginA = await store.completeOAuth(cookie(browserA.newToken!),'google',state,'google-verified-id','Болд');
    expect(loginA?.player.id).toBe(browserA.player.id);
    expect(await store.fromCookie(cookie(browserA.newToken!))).toBeNull();
    const browserB = await store.session(null);
    const otherState = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    expect(await store.startOAuth(cookie(browserB.newToken!),'google',otherState)).toBe(true);
    const loginB = await store.completeOAuth(cookie(browserB.newToken!),'google',otherState,'google-verified-id','Болд');
    expect(loginB?.player.id).toBe(loginA?.player.id);
    expect(loginB!.newToken).not.toBe(loginA!.newToken);
    expect((await store.fromCookie(cookie(loginA!.newToken)))?.id).toBe(loginA?.player.id);
    expect((await store.fromCookie(cookie(loginB!.newToken)))?.id).toBe(loginA?.player.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM leaderboard_sessions WHERE player_id=?').get(loginA!.player.id as string)?.n).toBe(2);
    const logoutB = await store.logout(cookie(loginB!.newToken));
    expect(logoutB.player.id).not.toBe(loginA?.player.id);
    expect(await store.fromCookie(cookie(loginB!.newToken))).toBeNull();
    expect((await store.fromCookie(cookie(loginA!.newToken)))?.id).toBe(loginA?.player.id);
  });
  it('migrates existing staging bearer cookies without deleting the player or score ledger', async () => {
    const {db,store} = fixture();
    const legacyToken = 'a'.repeat(64);
    const playerId = 'old-player';
    db.prepare('INSERT INTO leaderboard_players(id,guest_token,name,created_at) VALUES(?,?,?,?)')
      .run(playerId,legacyToken,'Саруул',Date.now());
    db.prepare('INSERT INTO leaderboard_races(race_id,player_id,points,wpm,accuracy,finished_at) VALUES(?,?,?,?,?,?)')
      .run('race-1',playerId,120,80,95,Date.now());
    expect((await store.fromCookie(cookie(legacyToken)))?.id).toBe(playerId);
    expect((await store.fromCookie(cookie(legacyToken)))?.id).toBe(playerId);
    expect(db.prepare('SELECT guest_token FROM leaderboard_players WHERE id=?').get(playerId)?.guest_token)
      .not.toBe(legacyToken);
    expect(db.prepare('SELECT COUNT(*) AS n FROM leaderboard_sessions WHERE player_id=?').get(playerId)?.n).toBe(1);
    const logout = await store.logout(cookie(legacyToken));
    expect(logout.player.id).not.toBe(playerId);
    expect(await store.fromCookie(cookie(legacyToken))).toBeNull();
    expect(db.prepare('SELECT points FROM leaderboard_races WHERE race_id=?').get('race-1')?.points).toBe(120);
  });
  it('expires a session without allowing plaintext fallback or resurrecting it', async () => {
    const {db,store} = fixture();
    const a = await store.session(null);
    db.exec('UPDATE leaderboard_sessions SET expires_at=0');
    expect(await store.fromCookie(cookie(a.newToken!))).toBeNull();
    const b = await store.session(cookie(a.newToken!));
    expect(b.player.id).not.toBe(a.player.id);
  });
  it('rejects expired/mismatched OAuth state and never issues provider session', async () => {
    const {db,store} = fixture();
    const a=await store.session(null);
    expect(await store.startOAuth(cookie(a.newToken!),'facebook',state)).toBe(true);
    const b=await store.session(null);
    expect(await store.completeOAuth(cookie(b.newToken!),'facebook',state,'fb-id','Other')).toBeNull();
    db.exec('UPDATE leaderboard_oauth_states SET expires_at=0');
    expect(await store.completeOAuth(cookie(a.newToken!),'facebook',state,'fb-id','Other')).toBeNull();
    expect(db.prepare('SELECT COUNT(*) AS n FROM leaderboard_identities').get()?.n).toBe(0);
  });
});
