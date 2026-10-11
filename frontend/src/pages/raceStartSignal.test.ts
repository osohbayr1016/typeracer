import { describe,expect,it } from 'vitest';
import { startSignal } from './raceStartSignal';
describe('server-clock synchronized race start lights',()=>{
  const t=Date.parse('2026-10-11T12:00:00Z');
  it('progresses red to yellow before the server start',()=>{
    expect(startSignal('countdown',t,t-3000)).toBe('red');
    expect(startSignal('countdown',t,t-2000)).toBe('yellow');
    expect(startSignal('countdown',t,t-10)).toBe('yellow');
  });
  it('displays green only AFTER the server phase starts',()=>{
    expect(startSignal('countdown',t,t+10)).toBe('yellow');
    expect(startSignal('racing',t,t+10)).toBe('green');
    expect(startSignal('racing',t,t+980)).toBe('off');
    expect(startSignal('finished',t,t+10)).toBe('off');
  });
});
