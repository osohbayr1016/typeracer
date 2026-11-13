import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { QuickCheckpoint } from './quickCheckpoint';
import { QuickCheckpointStore } from './quickCheckpoint';

const token = 'a5d6e7f8-9123-4123-8123-123456789abc';
const dbs: DatabaseSync[] = [];
function setup() {
  const db = new DatabaseSync(':memory:'); dbs.push(db);
  const sql = {
    exec(query: string, ...values: unknown[]) {
      const text = query.trim().toUpperCase();
      if (text.startsWith('CREATE ')) {
        db.exec(query);
        return {toArray: () => []};
      }
      const statement = db.prepare(query);
      if (text.startsWith('SELECT ')) return {toArray: () => statement.all(...values as Array<string|number|null>)};
      statement.run(...values as Array<string|number|null>);
      return {toArray: () => []};
    }
  } as unknown as Pick<SqlStorage, 'exec'>;
  return {db, sql, store: new QuickCheckpointStore(sql)};
}
const sample: QuickCheckpoint = {
  id:'race-1', phase:'racing', queueEndsAt:0, startAt:1700000000000,
  prompt:{id:'first',text:'Өвлийн өглөө',language:'mn'},
  humans:[{
    id:'p1',name:'Тэмүүлэн',ready:true,progress:2,mistakes:1,strokes:3,
    completedAt:null,accountId:'account-one',bot:false,paid:false,
    resumeToken:token,inputVersion:2,inputSeq:3,inputWrong:false,lastResult:null
  }],
  bots:[{id:'b1',name:'Хурдан бот',ready:true,progress:1,mistakes:0,
    strokes:1,completedAt:null,bot:true,pace:55}],
  botSequence:1, botOffset:2
};
afterEach(() => { for(const db of dbs.splice(0)) db.close(); });
describe('Durable Object SQLite quick checkpoints', () => {
  it('reconstructs accepted character progress and identity after a new store instance', () => {
    const {sql,store}=setup();
    store.register(sample.id,token,Date.now()+100_000);
    store.save(sample,Date.now()+100_000);
    const restored=new QuickCheckpointStore(sql).findByToken(token);
    expect(restored).toEqual(sample);
    expect(restored?.humans[0]).toMatchObject({inputSeq:3,progress:2,mistakes:1,accountId:'account-one'});
  });
  it('never returns expired, unknown or deleted resume tokens', () => {
    const {sql,store}=setup();
    const expiry=Date.now()+1000;
    store.register(sample.id,token,expiry);
    store.save(sample,expiry);
    expect(store.findByToken(token,expiry)).toBeNull();
    expect(store.findByToken('ffffffff-ffff-4fff-8fff-ffffffffffff')).toBeNull();
    expect(store.findByToken(token,expiry-1)).not.toBeNull();
    store.forget(sample.id);
    expect(new QuickCheckpointStore(sql).findByToken(token)).toBeNull();
  });
  it('keeps completed results idempotent in the saved checkpoint', () => {
    const {sql,store}=setup();
    const complete:QuickCheckpoint=JSON.parse(JSON.stringify(sample));
    complete.phase='finished';
    complete.humans[0].paid=true;
    complete.humans[0].lastResult={type:'quick-result',raceId:'race-1',place:2,coins:27,
      wpm:70,accuracy:96,elapsedMs:20000,verified:false,standings:[]};
    store.register(sample.id,token,Date.now()+10000);
    store.save(complete,Date.now()+10000);
    expect(new QuickCheckpointStore(sql).findByToken(token)?.humans[0].lastResult)
      .toMatchObject({raceId:'race-1',place:2,coins:27});
  });
});
