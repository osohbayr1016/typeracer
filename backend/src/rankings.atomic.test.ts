import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { RaceRankingStore, racingPoints } from './rankings';

const databases: DatabaseSync[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

describe('atomic match score ledger', () => {
  it('rolls back race, PvP qualification and player aggregate together on a failed write', async () => {
    const db = new DatabaseSync(':memory:'); databases.push(db);
    let failAggregate = false;
    const sql = { exec(query: string, ...params: unknown[]) {
      const trimmed = query.trim().toUpperCase();
      if (trimmed.startsWith('CREATE ')) { db.exec(query); return {toArray: () => []}; }
      if (failAggregate && trimmed.startsWith('UPDATE LEADERBOARD_PLAYERS SET POINTS=POINTS+?'))
        throw Error('simulated SQLite write failure');
      const statement = db.prepare(query);
      const values = params as Array<string | number | null>;
      if (trimmed.startsWith('SELECT ')) return {toArray: () => statement.all(...values)};
      statement.run(...values);
      return {toArray: () => []};
    }};
    const atomic = <T>(work: () => T): T => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const value = work();
        db.exec('COMMIT');
        return value;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };
    const rank = new RaceRankingStore(sql as unknown as Pick<SqlStorage,'exec'>, atomic);
    const account = await rank.session(null);
    const player = String(account.player.id);
    const count = (table: string) => Number(db.prepare('SELECT COUNT(*) AS n FROM ' + table).get()?.n);
    failAggregate = true;
    expect(() => rank.record('atomic-1', player, 80, 95, Date.now(), true))
      .toThrow('simulated SQLite write failure');
    expect(count('leaderboard_races')).toBe(0);
    expect(count('leaderboard_pvp_races')).toBe(0);
    expect(db.prepare('SELECT points,races FROM leaderboard_players WHERE id=?').get(player))
      .toMatchObject({points:0,races:0});
    failAggregate = false;
    const expected = racingPoints(80, 95, true);
    expect(rank.record('atomic-1', player, 80, 95, Date.now(), true)).toBe(expected);
    expect(rank.record('atomic-1', player, 80, 95, Date.now(), true)).toBe(0);
    expect(count('leaderboard_races')).toBe(1);
    expect(count('leaderboard_pvp_races')).toBe(1);
    expect(db.prepare('SELECT points,races FROM leaderboard_players WHERE id=?').get(player))
      .toMatchObject({points:expected,races:1});
  });
});
