import { describe, expect, it, vi } from 'vitest';
import { ReliableRaceInput, MAX_PENDING_KEYS, MAX_SOCKET_BUFFER } from './reliableInput';

const socket = () => ({readyState:1,bufferedAmount:0,send:vi.fn()});
describe('acknowledged typing prediction', () => {
  it('replays lost keys with their original sequence and keeps the caret immediate', () => {
    const input = new ReliableRaceInput('match','Өвөл'); const ws = socket();
    for (const key of ['Ө','в','ө']) expect(input.enqueue(key,ws,0)).toBe(true);
    expect(input.prediction).toMatchObject({progress:3,strokes:3,mistakes:0});
    input.acknowledge({seq:0,progress:0,strokes:0,mistakes:0});
    input.flush(ws,500);
    expect(ws.send.mock.calls.map(([raw]) => JSON.parse(raw).seq)).toEqual([1,2,3,1,2,3]);
    input.acknowledge({seq:2,progress:2,strokes:2,mistakes:0});
    expect(input.pendingCount).toBe(1); expect(input.prediction.progress).toBe(3);
    input.acknowledge({seq:3,progress:3,strokes:3,mistakes:0});
    input.acknowledge({seq:1,progress:1,strokes:1,mistakes:0});
    expect(input.pendingCount).toBe(0); expect(input.prediction.strokes).toBe(3);
  });
  it('retains real errors after their acknowledgement without double-counting retries', () => {
    const input = new ReliableRaceInput('match','ӨҮ'); const ws = socket();
    input.enqueue('O',ws,0);
    input.acknowledge({seq:1,progress:0,strokes:1,mistakes:1,wrong:true});
    expect(input.prediction.wrong).toBe(true);
    input.enqueue('Ө',ws,1); input.enqueue('Ү',ws,2);
    input.acknowledge({seq:2,progress:1,strokes:2,mistakes:1,wrong:false});
    expect(input.prediction).toEqual({progress:2,strokes:3,mistakes:1,wrong:false});
  });
  it('resumes a partially acknowledged match on a new socket and continues sequence numbers', () => {
    const input = new ReliableRaceInput('match','Өвөл'); const first = socket();
    input.enqueue('Ө',first,0); input.enqueue('в',first,10);
    first.readyState=3;
    expect(input.enqueue('ө',first,20)).toBe(false);
    const next=socket(); input.acknowledge({seq:1,progress:1,strokes:1,mistakes:0});
    input.flush(next,500); input.enqueue('ө',next,510);
    expect(next.send.mock.calls.map(([raw]) => JSON.parse(raw).seq)).toEqual([2,3]);
    expect(input.prediction.progress).toBe(3);
  });
  it('bounds memory, retransmission frequency and socket pressure', () => {
    const input=new ReliableRaceInput('match','а'.repeat(100)); const ws=socket();
    ws.bufferedAmount=MAX_SOCKET_BUFFER;
    expect(input.enqueue('а',ws,0)).toBe(false);ws.bufferedAmount=0;
    for(let i=0;i<MAX_PENDING_KEYS;i++)expect(input.enqueue('а',ws,i)).toBe(true);
    expect(input.enqueue('а',ws,100)).toBe(false);
    expect(input.delayed(2000)).toBe(true);
    ws.send.mockClear();input.flush(ws,2000);input.flush(ws,2010);
    expect(ws.send).toHaveBeenCalledTimes(32);
  });
  it('normalizes composed Unicode and rejects paste/control keys before prediction', () => {
    const input=new ReliableRaceInput('match','éӨ');const ws=socket();
    expect(input.enqueue('e\u0301',ws,0)).toBe(true);
    expect(input.enqueue('\t',ws,0)).toBe(false);expect(input.enqueue('ӨҮ',ws,0)).toBe(false);
    expect(input.prediction.progress).toBe(1);expect(ws.send).toHaveBeenCalledTimes(1);
  });
});
