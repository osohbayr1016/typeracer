import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {GlobalAbuseLimiter} from './rateLimits';
import {RaceRoom} from './room';

const opened:DatabaseSync[]=[];
function fixture(){
  const db=new DatabaseSync(':memory:');opened.push(db);
  const sql={exec(query:string,...args:unknown[]){
    const stmt=db.prepare(query);
    const params=args as Array<string|number|null>;
    if(query.trim().toUpperCase().startsWith('SELECT '))return {toArray:()=>stmt.all(...params)};
    stmt.run(...params);
    return {toArray:()=>[]};
  }};
  const atomic=<T>(fn:()=>T):T=>{
    db.exec('BEGIN IMMEDIATE');
    try{const value=fn();db.exec('COMMIT');return value;}
    catch(e){db.exec('ROLLBACK');throw e;}
  };
  return {db,sql:sql as unknown as Pick<SqlStorage,'exec'>,atomic};
}
afterEach(()=>{for(const db of opened.splice(0))db.close();});
describe('shared checkout and recovery abuse limits',()=>{
  const base=Date.parse('2026-11-13T10:00:00Z');
  it('limits the same IP across independent limiter instances and restores after a minute',async()=>{
    const {db,sql,atomic}=fixture();
    const one=new GlobalAbuseLimiter(sql,atomic);
    for(let n=0;n<10;n++)expect(await one.check('checkout','203.0.113.20',10,60_000,base))
      .toMatchObject({allowed:true});
    const two=new GlobalAbuseLimiter(sql,atomic);
    expect(await two.check('checkout','203.0.113.20',10,60_000,base+2000))
      .toMatchObject({allowed:false,retryAfterSeconds:58});
    expect(await two.check('checkout','203.0.113.20',10,60_000,base+60_000))
      .toMatchObject({allowed:true,retryAfterSeconds:0});
    const rows=JSON.stringify(db.prepare('SELECT * FROM abuse_limit_windows').all());
    expect(rows).not.toContain('203.0.113.20');
    expect(db.prepare('SELECT salt FROM abuse_limit_meta WHERE slot=1').get()?.salt).toBeTruthy();
    expect(rows).not.toContain('checkout');
  });
  it('does not penalize a different IP or independent abuse scope',async()=>{
    const {sql,atomic}=fixture();
    const limiter=new GlobalAbuseLimiter(sql,atomic);
    for(let n=0;n<8;n++)await limiter.check('recovery','203.0.113.1',8,60_000,base);
    expect((await limiter.check('recovery','203.0.113.1',8,60_000,base)).allowed).toBe(false);
    expect((await limiter.check('recovery','203.0.113.2',8,60_000,base)).allowed).toBe(true);
    expect((await limiter.check('checkout','203.0.113.1',10,60_000,base)).allowed).toBe(true);
    await expect(limiter.check('', '203.0.113.1',10,60_000,base)).rejects.toThrow();
  });
  it('enforces durable room-creation quotas across coordinator restarts and isolates',async()=>{
    const {sql,atomic}=fixture();
    const state={storage:{sql,transactionSync:atomic}} as unknown as DurableObjectState;
    const room=new RaceRoom(state,{});
    const request=(ip:string)=>new Request('https://room.internal/abuse/rooms',{
      method:'POST',headers:{'CF-Connecting-IP':ip}
    });
    for(let n=0;n<10;n++){
      const result=await room.fetch(request('198.51.100.11'));
      expect(result.status).toBe(200);
    }
    const resumed=new RaceRoom(state,{});
    const blocked=await resumed.fetch(request('198.51.100.11'));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({error:'rate_limit_exceeded'});
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await resumed.fetch(request('198.51.100.12'))).status).toBe(200);
    // Separate scope: checkout/recovery quotas remain unaffected.
    const checkout=new GlobalAbuseLimiter(sql,atomic);
    expect((await checkout.check('checkout','198.51.100.11',10,60_000)).allowed).toBe(true);
  });
  it('enforces account recovery limit in the real Durable Object before parsing untrusted codes',async()=>{
    const {sql,atomic}=fixture();
    const state={storage:{sql,transactionSync:atomic}} as unknown as DurableObjectState;
    const room=new RaceRoom(state,{});
    const request=()=>new Request('https://room.internal/account/recover',{
      method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.77'},
      body:JSON.stringify({code:'not-real'})
    });
    for(let n=0;n<8;n++){
      const response=await room.fetch(request());
      expect(response.status).toBe(400);
    }
    const rejected=await room.fetch(request());
    expect(rejected.status).toBe(429);
    expect(rejected.headers.get('Retry-After')).toBe('60');
    expect(await rejected.json()).toMatchObject({error:'rate_limit_exceeded'});
  });
});
