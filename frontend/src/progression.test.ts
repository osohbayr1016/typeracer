import { describe, it, expect } from 'vitest';
import { buyItem, claimReward, equipItem, isOwned, raceReward, starterProfile, SEASON } from './progression';

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
