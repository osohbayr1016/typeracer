/** Shared, privacy-minimizing abuse limits inside the named Durable Object.
 * All edge Workers use this same SQLite counter instead of independent Maps.
 * A per-DO random salt keeps IP addresses out of durable database rows.
 */
export type LimitDecision={allowed:boolean;retryAfterSeconds:number};
type SQL=Pick<SqlStorage,'exec'>;
const first=(sql:SQL,query:string,...args:(string|number)[]) =>
  sql.exec(query,...args).toArray()[0] as Record<string,unknown>|undefined;

export class GlobalAbuseLimiter {
  private salt:string;
  private writes=0;
  constructor(private sql:SQL,private atomic:<T>(fn:()=>T)=>T=fn=>fn()){
    sql.exec(`CREATE TABLE IF NOT EXISTS abuse_limit_meta(
      slot INTEGER PRIMARY KEY CHECK(slot=1),salt TEXT NOT NULL)`);
    sql.exec('INSERT OR IGNORE INTO abuse_limit_meta(slot,salt) VALUES(1,?)',crypto.randomUUID());
    this.salt=String(first(sql,'SELECT salt FROM abuse_limit_meta WHERE slot=1')?.salt);
    sql.exec(`CREATE TABLE IF NOT EXISTS abuse_limit_windows(
      fingerprint TEXT PRIMARY KEY,started_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL)`);
    sql.exec('CREATE INDEX IF NOT EXISTS abuse_limit_expiry ON abuse_limit_windows(expires_at)');
    sql.exec('DELETE FROM abuse_limit_windows WHERE expires_at<?',Date.now());
  }
  /** Identity is Cloudflare's trusted connecting IP, never a client-supplied
   * X-Forwarded-For. No IP is stored, logged or returned to the caller.
   */
  async check(scope:string,identity:string,limit:number,windowMs:number,
    at=Date.now()):Promise<LimitDecision>{
    if(!scope || !identity || !Number.isInteger(limit)||limit<1||
       !Number.isInteger(windowMs)||windowMs<1000)throw Error('Invalid rate limit');
    const encoded=new TextEncoder().encode(this.salt+':'+scope+':'+identity);
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoded));
    const fingerprint=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return this.atomic(()=>{
      const row=first(this.sql,'SELECT started_at,attempts FROM abuse_limit_windows WHERE fingerprint=?',fingerprint);
      if(row){
        const started=Number(row.started_at),used=Number(row.attempts);
        if(at-started<windowMs && at>=started){
          if(used>=limit)return {allowed:false,retryAfterSeconds:Math.max(1,Math.ceil((started+windowMs-at)/1000))};
          this.sql.exec('UPDATE abuse_limit_windows SET attempts=? WHERE fingerprint=?',used+1,fingerprint);
          return {allowed:true,retryAfterSeconds:0};
        }
      }
      this.sql.exec(`INSERT INTO abuse_limit_windows(fingerprint,started_at,attempts,expires_at)
        VALUES(?,?,1,?) ON CONFLICT(fingerprint) DO UPDATE SET
        started_at=excluded.started_at,attempts=1,expires_at=excluded.expires_at`,
        fingerprint,at,at+windowMs);
      // Opportunistic cleanup without deleting counters in an active window.
      if(++this.writes%500===0)this.sql.exec('DELETE FROM abuse_limit_windows WHERE expires_at<?',at);
      return {allowed:true,retryAfterSeconds:0};
    });
  }
}
