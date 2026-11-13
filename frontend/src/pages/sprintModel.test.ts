import { describe, expect, it } from 'vitest';
import { EMPTY_SPRINT, sprintAdvance, sprintDailyKey, sprintScore, sprintSeed, sprintText } from './sprintModel';

describe('timed Mongolian sprint', () => {
  it('uses Mongolian midnight even if the visitor lives in another timezone', () => {
    expect(sprintDailyKey(Date.UTC(2026, 10, 12, 15, 59))).toBe('2026-11-12');
    expect(sprintDailyKey(Date.UTC(2026, 10, 12, 16, 0))).toBe('2026-11-13');
  });
  it('gives all players the same daily passage but changes it on another day', () => {
    const seed = sprintSeed('2026-11-13');
    expect(sprintSeed('2026-11-13')).toBe(seed);
    expect(sprintSeed('2026-11-14')).not.toBe(seed);
    expect(sprintText(seed)).toBe(sprintText(seed));
    expect(sprintText(seed).length).toBeGreaterThan(900);
    expect(sprintText(seed)).toMatch(/[ӨөҮү]/u);
  });
  it('counts wrong keys without moving the caret, and never credits multiple pasted keys', () => {
    const wrong = sprintAdvance(EMPTY_SPRINT, 'x', 'Өвөл');
    expect(wrong).toEqual({position:0,attempts:1,mistakes:1});
    expect(sprintAdvance(wrong, 'Өв', 'Өвөл')).toBe(wrong);
    const correct = sprintAdvance(wrong, 'Ө', 'Өвөл');
    expect(correct).toEqual({position:1,attempts:2,mistakes:1});
    expect(sprintScore(correct, 15_000)).toEqual({
      wpm: 1, accuracy: 50, correct: 1, mistakes: 1, elapsedMs: 15_000
    });
  });
  it('normalizes composed characters before scoring', () => {
    expect(sprintAdvance(EMPTY_SPRINT, 'e\u0301', 'é')).toMatchObject({position:1,attempts:1,mistakes:0});
    expect(sprintAdvance(EMPTY_SPRINT, '\t', 'Ө')).toBe(EMPTY_SPRINT);
  });
});
