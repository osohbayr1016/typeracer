import { describe, expect, it } from 'vitest';
import { START_COUNTDOWN_MS, START_LIGHT_MS } from '@typeracer/shared';
import { raceCanType, startSignal } from './raceStartSignal';
describe('server-announced constant start lights', () => {
  const t = Date.parse('2026-10-11T12:00:00Z');
  it('gives red, yellow and green exactly one second each', () => {
    expect(START_COUNTDOWN_MS).toBe(2 * START_LIGHT_MS);
    for (let ms = -2000; ms < 1000; ms++) {
      expect(startSignal(ms < 0 ? 'countdown' : 'racing', t, t + ms))
        .toBe(ms < -1000 ? 'red' : ms < 0 ? 'yellow' : 'green');
    }
    expect(startSignal('racing', t, t + 1000)).toBe('off');
  });
  it('turns green at the announced deadline without waiting for a delayed racing packet', () => {
    expect(startSignal('countdown', t, t - 1)).toBe('yellow');
    expect(raceCanType('countdown', t, t - 1)).toBe(false);
    expect(startSignal('countdown', t, t)).toBe('green');
    expect(raceCanType('countdown', t, t)).toBe(true);
    expect(startSignal('countdown', t, t + 500)).toBe('green');
    expect(startSignal('finished', t, t)).toBe('off');
    expect(raceCanType('finished', t, t + 1)).toBe(false);
    expect(raceCanType('waiting', null, t)).toBe(false);
  });
});
