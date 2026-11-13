import type { Prompt, RacePhase, Racer } from '@typeracer/shared';

/** Serializable private-room state. Never store sockets or active timers. */
export type StoredPrivateRacer = Racer & {
  resumeToken: string;
  windowStart: number;
  windowCount: number;
  disconnectedAt: number | null;
};
export type PrivateCheckpoint = {
  matchId: string;
  phase: RacePhase;
  prompt: Prompt;
  startAt: number | null;
  racers: StoredPrivateRacer[];
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validPrivateCheckpoint(record: unknown): record is PrivateCheckpoint {
  if (!record || typeof record !== 'object') return false;
  const x=record as Partial<PrivateCheckpoint>;
  return typeof x.matchId==='string' && UUID.test(x.matchId) &&
    ['waiting','countdown','racing','finished'].includes(String(x.phase)) &&
    typeof x.prompt?.text==='string' && x.prompt.text.length>0 &&
    x.prompt.text.length<=1200 &&
    (x.startAt===null || (typeof x.startAt==='number' && Number.isFinite(x.startAt))) &&
    Array.isArray(x.racers) && x.racers.length<=6 &&
    x.racers.every(p=>p && UUID.test(String(p.id)) &&
      UUID.test(String(p.resumeToken)) && typeof p.name==='string' &&
      Number.isInteger(p.progress) && p.progress>=0 &&
      Number.isInteger(p.strokes) && p.strokes>=0 &&
      Number.isInteger(p.mistakes) && p.mistakes>=0);
}

/** One checkpoint per DO room, in its own SQLite. A resume bearer is never
 * sent inside a public state snapshot, only in an individual welcome event.
 * Rooms expire at the same 1-hour boundary as their invitation codes.
 */
export class PrivateCheckpointStore {
  constructor(private sql:Pick<SqlStorage,'exec'>) {
    sql.exec(`CREATE TABLE IF NOT EXISTS private_room_checkpoint(
      slot INTEGER PRIMARY KEY CHECK(slot=1),
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    sql.exec('DELETE FROM private_room_checkpoint WHERE expires_at<?',Date.now());
  }
  load(at=Date.now()):PrivateCheckpoint|null {
    const row=this.sql.exec(
      'SELECT payload FROM private_room_checkpoint WHERE slot=1 AND expires_at>? LIMIT 1',at
    ).toArray()[0] as {payload:string}|undefined;
    if (!row)return null;
    try {
      const parsed:unknown=JSON.parse(row.payload);
      return validPrivateCheckpoint(parsed)?parsed:null;
    } catch {return null;}
  }
  save(snapshot:PrivateCheckpoint,expiresAt:number) {
    if (!validPrivateCheckpoint(snapshot))throw Error('Invalid private-room checkpoint');
    this.sql.exec(`INSERT INTO private_room_checkpoint(slot,payload,expires_at) VALUES(1,?,?)
      ON CONFLICT(slot) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at`,
      JSON.stringify(snapshot),expiresAt);
  }
  clear() {this.sql.exec('DELETE FROM private_room_checkpoint WHERE slot=1');}
}
