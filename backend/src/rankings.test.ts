import { describe, expect, it } from 'vitest';
import { RaceRankingStore, racingPoints } from './rankings';

describe('server-only competitive race scoring',()=>{
  it('rewards speed and accuracy, not level, coins or match placement',()=>{
    expect(racingPoints(100,99,true)).toBeGreaterThan(racingPoints(60,99,true));
    expect(racingPoints(100,99,true)).toBeGreaterThan(racingPoints(100,85,true));
    expect(racingPoints(100,99,false)).toBe(0);
    expect(racingPoints(100,69,true)).toBe(0);
    expect(racingPoints(211,100,true)).toBe(0);
    expect(racingPoints(Number.POSITIVE_INFINITY,100,true)).toBe(0);
    expect(racingPoints(90,101,true)).toBe(0);
    expect(racingPoints(60,95,true)).toBe(19);
    expect(racingPoints(80,95,true)).toBe(23);
    expect(racingPoints(100,99,true)).toBe(28);
    expect(racingPoints(120,100,true)).toBe(33);
    expect(racingPoints(0,100,true)).toBe(10);
  });
  it('resets only weekly board at Mongolia-local Monday 00:00, preserving all-time totals',()=>{
    // On Sunday 23:59 in Ulaanbaatar, the previous local Monday still applies.
    expect(RaceRankingStore.weekStart(Date.parse('2026-10-11T15:59:59Z')))
      .toBe(Date.parse('2026-10-04T16:00:00Z'));
    // Exactly one second later it becomes Monday 00:00 in Mongolia.
    expect(RaceRankingStore.weekStart(Date.parse('2026-10-11T16:00:00Z')))
      .toBe(Date.parse('2026-10-11T16:00:00Z'));
    expect(RaceRankingStore.weekStart(Date.parse('2026-10-12T00:00:00Z')))
      .toBe(Date.parse('2026-10-11T16:00:00Z'));
    expect(RaceRankingStore.weekStart(Date.parse('2027-01-01T12:00:00Z')))
      .toBe(Date.parse('2026-12-27T16:00:00Z'));
  });
});
