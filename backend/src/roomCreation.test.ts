import { describe, expect, it } from 'vitest';
import app from './index';
import { RaceRoom } from './room';

type Storage = {get:(key:string)=>Promise<unknown>;put:(key:string,value:unknown)=>Promise<void>};
function fakeNamespace(alwaysConflict=false) {
  const attempts:string[]=[];
  const globalId='MONGOLIAN-QUICK-V1';
  const ns={
    idFromName:(name:string)=>name,
    get:(id:string)=>({
      fetch:async (_input:Request|string,_init?:RequestInit) => {
        if(id===globalId)return Response.json({ok:true});
        attempts.push(id);
        return new Response(null,{status:alwaysConflict||attempts.length<3?409:201});
      }
    })
  };
  return {ns,attempts};
}
describe('write-once private invitation codes',()=>{
  it('does not reset an existing Durable Object, even if its invitation has expired',async()=>{
    const values=new Map<string,unknown>();
    const storage:Storage & {transaction:<T>(fn:(tx:Storage)=>Promise<T>)=>Promise<T>}={
      get:async key=>values.get(key),
      put:async(key,value)=>{values.set(key,value);},
      transaction:async fn=>fn(storage)
    };
    const room=new RaceRoom({storage} as unknown as DurableObjectState,{});
    const request=()=>new Request('https://room.internal/create',{method:'POST'});
    expect((await room.fetch(request())).status).toBe(201);
    const createdAt=values.get('createdAt');
    expect(typeof createdAt).toBe('number');
    expect((await room.fetch(request())).status).toBe(409);
    expect(values.get('createdAt')).toBe(createdAt);
    // Expiry does not authorize reusing old codes/checkpoints.
    values.set('createdAt',Date.now()-7_200_000);
    expect((await room.fetch(request())).status).toBe(409);
    expect(values.get('createdAt')).toBeLessThan(Date.now()-3_600_000);
  });
  it('retries a collision and returns the fresh invitation code',async()=>{
    const {ns,attempts}=fakeNamespace();
    const response=await app.request('http://localhost/api/rooms',
      {method:'POST'}, {RACE_ROOMS:ns} as never);
    expect(response.status).toBe(201);
    expect(attempts).toHaveLength(3);
    const payload=await response.json() as {code:string;capacity:number};
    expect(payload.code).toBe(attempts[2]);
    expect(payload.code).toMatch(/^[A-F0-9]{8}$/);
    expect(payload.capacity).toBeGreaterThan(1);
  });
  it('returns an honest failure after bounded collisions, not another player’s code',async()=>{
    const {ns,attempts}=fakeNamespace(true);
    const response=await app.request('http://localhost/api/rooms',
      {method:'POST'}, {RACE_ROOMS:ns} as never);
    expect(response.status).toBe(503);
    expect(attempts).toHaveLength(5);
    expect(await response.json()).toMatchObject({error:expect.stringMatching(/allocate/)});
  });
});
