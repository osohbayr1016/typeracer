import { describe, it, expect } from 'vitest';
import { buyItem, claimReward, equipItem, isOwned, raceReward, starterProfile, SEASON, SHOP, NEW_CAR_COLLECTION, playerLevel, shopRotation,
  isLevelUnlocked, COLLECTION_RARITIES } from './progression';

describe('Mongolian device-local cosmetic economy', () => {
  it('buys one deterministic shop item once and equips only what is owned', () => {
    const original = starterProfile();
    expect(isOwned(original, 'car', 'steppe')).toBe(false);
    const purchased = buyItem(original, 'trail', 'ember');
    expect(purchased.coins).toBe(80);
    expect(isOwned(purchased, 'trail', 'ember')).toBe(true);
    expect(buyItem(purchased, 'trail', 'ember')).toBe(purchased);
    expect(equipItem(original, 'trail', 'ember')).toBe(original);
    expect(equipItem(purchased, 'trail', 'ember').trail).toBe('ember');
    expect(buyItem(purchased, 'car', 'midnight')).toBe(purchased);
  });
  it('awards XP and coins for completed races and refuses impossible data', () => {
    const first = starterProfile();
    expect(raceReward(first, { wpm: 50, accuracy: 101, elapsedMs: 10_000, at: SEASON.from + 3000 })).toBe(first);
    const result = raceReward(first, { wpm: 90, accuracy: 99, elapsedMs: 26_000, at: SEASON.from + 3000 });
    expect(result.races).toBe(1);
    expect(result.xp).toBeGreaterThan(0);
    expect(result.coins).toBeGreaterThan(first.coins);
    expect(result.seasonXp).toBe(result.xp);
    expect(result.history[0]?.accuracy).toBe(99);
  });
  it('claims season rewards only once, on time, and after reaching XP threshold', () => {
    const initial = starterProfile();
    expect(claimReward(initial, 1, SEASON.from + 1000)).toBe(initial);
    const enough = { ...initial, seasonXp: 300 };
    expect(claimReward(enough, 1, SEASON.from - 1)).toBe(enough);
    const claimed = claimReward(enough, 1, SEASON.from + 1000);
    expect(claimed.coins).toBe(initial.coins + 120);
    expect(claimed.claimed).toContain(1);
    expect(claimReward(claimed, 1, SEASON.from + 1000)).toBe(claimed);
    const sticker = claimReward(claimed, 2, SEASON.from + 1000);
    expect(isOwned(sticker, 'sticker', 'star')).toBe(true);
    expect(claimReward(sticker, 3, SEASON.from + 1000)).toBe(sticker);
  });
});


describe('six rarity collections, level economy and featured rotation', () => {
  it('has exactly six rarities with three unique original cars each', () => {
    expect(COLLECTION_RARITIES).toHaveLength(6);
    expect(NEW_CAR_COLLECTION).toHaveLength(18);
    expect(new Set(NEW_CAR_COLLECTION.map(car => car.id)).size).toBe(18);
    for (const rarity of COLLECTION_RARITIES) {
      const three = NEW_CAR_COLLECTION.filter(car => car.rarity === rarity.id);
      expect(three).toHaveLength(3);
      expect(three.every(car => car.preview.endsWith('.svg'))).toBe(true);
      expect(three.every(car => car.minLevel !== undefined && car.minLevel >= rarity.level)).toBe(true);
      expect(three.every(car => car.price > 0 && !!car.effect)).toBe(true);
    }
    expect(SHOP.filter(car => car.kind === 'car').length).toBe(21);
  });
  it('never bypasses level-gating with a large balance', () => {
    const newRacer = { ...starterProfile(), coins: 50_000 };
    const highTier = NEW_CAR_COLLECTION.find(item => item.id === 'dragon')!;
    expect(playerLevel(newRacer.xp)).toBe(1);
    expect(isLevelUnlocked(newRacer, highTier)).toBe(false);
    expect(buyItem(newRacer, 'car', highTier.id)).toBe(newRacer);
    const veteran = { ...newRacer, xp: (highTier.minLevel! - 1) * 300 };
    expect(isLevelUnlocked(veteran, highTier)).toBe(true);
    const purchased = buyItem(veteran, 'car', highTier.id);
    expect(purchased.coins).toBe(veteran.coins - highTier.price);
    expect(isOwned(purchased, 'car', highTier.id)).toBe(true);
    const equipped = equipItem(purchased, 'car', highTier.id);
    expect(equipped.car).toBe(highTier.id);
    expect(buyItem(purchased, 'car', highTier.id)).toBe(purchased);
  });
  it('rotates featured and daily highlights deterministically without hiding or duplicate offers', () => {
    const first = shopRotation(Date.parse('2026-10-11T08:00:00+08:00'));
    const again = shopRotation(Date.parse('2026-10-11T12:00:00+08:00'));
    expect(first).toEqual(again);
    expect(first.featured).toHaveLength(2);
    expect(first.daily).toHaveLength(3);
    expect(new Set(first.featured.map(item => item.id)).size).toBe(2);
    expect(new Set(first.daily.map(item => item.id)).size).toBe(3);
    expect(shopRotation(Date.parse('2026-10-12T08:00:00+08:00')).daily.map(i => i.id)).not.toEqual(first.daily.map(i => i.id));
    expect(NEW_CAR_COLLECTION).toHaveLength(18);
  });
});
