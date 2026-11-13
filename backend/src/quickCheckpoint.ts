import type { Prompt, RacePhase, Racer } from '@typeracer/shared';

/** Only serializable game state. Never serialize WebSockets, timers or the DO instance. */
export type StoredQuickResult = {
  type: 'quick-result'; raceId: string; place: number | null; coins: number;
  wpm: number; accuracy: number; elapsedMs: number; verified: false;
  standings: Racer[];
};
export type StoredQuickHuman = Racer & {
  resumeToken: string; accountId: string | null; paid: boolean;
  inputVersion: 1 | 2; inputSeq: number; inputWrong: boolean;
  lastResult: StoredQuickResult | null;
};
export type StoredQuickBot = Racer & {bot: true; pace: number};
export type QuickCheckpoint = {
  id: string; prompt: Prompt; phase: RacePhase; startAt: number | null; queueEndsAt: number;
  humans: StoredQuickHuman[]; bots: StoredQuickBot[];
  botSequence: number; botOffset: number; humanCountAtStart?: number;
};

/** Race checkpoints survive a Cloudflare Durable Object isolate restart.
 * A separate opaque token index avoids scanning other players' private records.
 * Expiry and deletion are bounded; no public endpoint can read checkpoint data.
 */
export class QuickCheckpointStore {
  constructor(private sql: Pick<SqlStorage, 'exec'>) {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS quick_checkpoints (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS quick_resume_tokens (
      token TEXT PRIMARY KEY, race_id TEXT NOT NULL, expires_at INTEGER NOT NULL
    )`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS quick_checkpoints_expiry ON quick_checkpoints(expires_at)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS quick_resume_expiry ON quick_resume_tokens(expires_at)');
    const now = Date.now();
    this.sql.exec('DELETE FROM quick_checkpoints WHERE expires_at<?', now);
    this.sql.exec('DELETE FROM quick_resume_tokens WHERE expires_at<?', now);
  }
  save(record: QuickCheckpoint, expiresAt: number) {
    this.sql.exec(`INSERT INTO quick_checkpoints(id,payload,expires_at) VALUES(?,?,?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at`,
    record.id, JSON.stringify(record), expiresAt);
  }
  register(raceId: string, token: string, expiresAt: number) {
    this.sql.exec('INSERT OR REPLACE INTO quick_resume_tokens(token,race_id,expires_at) VALUES(?,?,?)',
      token, raceId, expiresAt);
  }
  findByToken(token: string, now = Date.now()): QuickCheckpoint | null {
    if (!/^[0-9a-f-]{36}$/.test(token)) return null;
    const rows = this.sql.exec(`SELECT c.payload FROM quick_resume_tokens r
      JOIN quick_checkpoints c ON c.id=r.race_id
      WHERE r.token=? AND r.expires_at>? AND c.expires_at>? LIMIT 1`,
      token, now, now).toArray() as Array<{payload: string}>;
    if (!rows.length) return null;
    try {
      const record = JSON.parse(rows[0].payload) as QuickCheckpoint;
      if (!record || typeof record.id !== 'string' || !Array.isArray(record.humans) ||
          !Array.isArray(record.bots) || typeof record.prompt?.text !== 'string' ||
          !record.humans.some(h => h.resumeToken === token)) return null;
      return record;
    } catch { return null; }
  }
  forget(id: string) {
    this.sql.exec('DELETE FROM quick_resume_tokens WHERE race_id=?', id);
    this.sql.exec('DELETE FROM quick_checkpoints WHERE id=?', id);
  }
}
