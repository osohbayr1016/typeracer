import { describe, expect, it } from 'vitest';
import { authorizedRaceCar, CAR_IDS, STARTER_CAR_IDS, SHOP } from './catalog';

describe('trusted race car appearance', () => {
  it('allows all original guest cars without a paid or earned account', () => {
    for (const car of STARTER_CAR_IDS) expect(authorizedRaceCar(car, [])).toBe(car);
  });
  it('rejects forged premium cars and unknown catalog values', () => {
    for (const car of CAR_IDS.filter(id=>!(STARTER_CAR_IDS as readonly string[]).includes(id))) {
      expect(authorizedRaceCar(car, [])).toBe('sunset');
      expect(authorizedRaceCar(car, ['trail:ember'])).toBe('sunset');
      expect(authorizedRaceCar(car, ['car:'+car])).toBe(car);
    }
    expect(authorizedRaceCar('does-not-exist',['car:does-not-exist'])).toBe('sunset');
    expect(authorizedRaceCar(null,[])).toBe('sunset');
  });
  it('keeps every purchasable car in one canonical multiplayer allowlist', () => {
    for (const item of SHOP.filter(item=>item.kind==='car')) {
      expect(CAR_IDS).toContain(item.id);
    }
  });
});
