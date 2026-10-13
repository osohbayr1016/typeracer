import { describe, it, expect } from 'vitest';
import { buyItem, claimReward, equipItem, isOwned, raceReward, starterProfile, SEASON, SHOP, NEW_CAR_COLLECTION, playerLevel, shopRotation,
  isLevelUnlocked, COLLECTION_RARITIES, seasonProgress, claimAvailableRewards, SEASON_REWARDS,
  awardQuickRace, claimDailyQuest, dailyQuests, mongoliaDayKey, quickDayStreak } from './progression';

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
    expect(result.coins-first.coins).toBeGreaterThanOrEqual(20);
    expect(result.coins-first.coins).toBeLessThanOrEqual(30);
    expect(result.seasonXp).toBe(result.xp);
    expect(result.history[0]?.accuracy).toBe(99);
  });
  it('claims season rewards only once, on time, and after reaching XP threshold', () => {
    const initial = starterProfile();
    expect(claimReward(initial, 1, SEASON.from + 1000)).toBe(initial);
    const enough = { ...initial, seasonXp: 350 };
    expect(claimReward(enough, 1, SEASON.from - 1)).toBe(enough);
    const claimed = claimReward(enough, 1, SEASON.from + 1000);
    expect(claimed.coins).toBe(initial.coins + 120);
    expect(claimed.claimed).toContain(1);
    expect(claimReward(claimed, 1, SEASON.from + 1000)).toBe(claimed);
    const sticker = claimReward({ ...claimed, seasonXp: 850 }, 2, SEASON.from + 1000);
    expect(isOwned(sticker, 'sticker', 'star')).toBe(true);
    expect(claimReward(sticker, 3, SEASON.from + 1000)).toBe(sticker);
  });
});


describe('six rarity collections, level economy and featured rotation', () => {
  it('retains six rarities, three original cars and one new side-view car in each', () => {
    expect(COLLECTION_RARITIES).toHaveLength(6);
    expect(NEW_CAR_COLLECTION).toHaveLength(24);
    expect(new Set(NEW_CAR_COLLECTION.map(car => car.id)).size).toBe(24);
    for (const rarity of COLLECTION_RARITIES) {
      const four = NEW_CAR_COLLECTION.filter(car => car.rarity === rarity.id);
      expect(four).toHaveLength(4);
      expect(four.every(car => car.preview === `/cars/${car.id}.webp`)).toBe(true);
      expect(four.every(car => car.minLevel !== undefined && car.minLevel >= rarity.level)).toBe(true);
      expect(four.every(car => car.price > 0 && !!car.effect)).toBe(true);
    }
    expect(SHOP.filter(car => car.kind === 'car').length).toBe(27);
  });
  it('adds six new original side-view rarity cars with correct assets, purchase gates, and equip identity', () => {
    const expected = [
      ['side-common-graphite', 'Энгийн', 425, 2],
      ['side-uncommon-cobalt', 'Сайжруулсан', 800, 5],
      ['side-rare-lightning', 'Ховор', 1250, 9],
      ['side-epic-violet', 'Онцгой', 1900, 15],
      ['side-mythic-emerald', 'Туульс', 3100, 24],
      ['side-legend-cyber', 'Домогт', 5400, 36],
    ] as const;
    expect(new Set(expected.map(([id]) => id)).size).toBe(6);
    for(const [id,rarity,price,level] of expected) {
      const item = NEW_CAR_COLLECTION.find(i=>i.id===id);
      expect(item).toBeDefined();
      expect(item).toMatchObject({kind:'car',rarity,price,minLevel:level,preview:'/cars/'+id+'.webp'});
      const before = {...starterProfile(),xp:(level-2)*300,coins:20_000};
      expect(isLevelUnlocked(before,item!)).toBe(false);
      expect(buyItem(before,'car',id)).toBe(before);
      const lowCoins = {...before,xp:(level-1)*300,coins:price-1};
      expect(buyItem(lowCoins,'car',id)).toBe(lowCoins);
      const ready = {...before,xp:(level-1)*300};
      const bought = buyItem(ready,'car',id);
      expect(bought.coins).toBe(ready.coins-price);
      expect(isOwned(bought,'car',id)).toBe(true);
      expect(buyItem(bought,'car',id)).toBe(bought);
      expect(equipItem(bought,'car',id).car).toBe(id);
    }
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
    expect(NEW_CAR_COLLECTION).toHaveLength(24);
  });
});


describe('free season battle pass progress and bulk claiming', () => {
  it('calculates an understandable next goal and claimable rewards', () => {
    const initial = starterProfile();
    const start = seasonProgress(initial, SEASON.from + 1000);
    expect(start.active).toBe(true);
    expect(start.next?.tier).toBe(1);
    expect(start.xpToNext).toBe(350);
    expect(start.claimable).toHaveLength(0);
    expect(start.totalPercent).toBe(0);

    const profile = { ...initial, seasonXp: 920 };
    const halfway = seasonProgress(profile, SEASON.from + 1000);
    expect(halfway.claimable.map(r => r.tier)).toEqual([1, 2]);
    expect(halfway.next?.tier).toBe(3);
    expect(halfway.previousXp).toBe(850);
    expect(halfway.targetXp).toBe(1650);
    expect(halfway.xpToNext).toBe(730);
    expect(halfway.segmentPercent).toBe(9);
    expect(halfway.totalPercent).toBeGreaterThan(8);
    expect(halfway.focused.tier).toBe(1);
  });

  it('claims all earned rewards exactly once in a single profile update', () => {
    const profile = { ...starterProfile(), seasonXp: 9000 };
    const when = SEASON.from + 1000;
    const claimed = claimAvailableRewards(profile, when);
    expect(claimed.claimed).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(claimed.coins).toBe(profile.coins + 120 + 350);
    expect(isOwned(claimed, 'car', 'dawn')).toBe(true);
    expect(isOwned(claimed, 'car', 'khan')).toBe(true);
    expect(isOwned(claimed, 'trail', 'aurora')).toBe(true);
    expect(isOwned(claimed, 'sticker', 'star')).toBe(true);
    expect(isOwned(claimed, 'car', 'cosmic')).toBe(false);
    expect(claimAvailableRewards(claimed, when)).toBe(claimed);
    expect(claimAvailableRewards(profile, SEASON.until)).toBe(profile);
    expect(claimAvailableRewards(profile, SEASON.from - 1)).toBe(profile);
  });

  it('supports full completion with eight nonrandom rewards', () => {
    const profile = { ...starterProfile(), seasonXp: 10500 };
    const all = claimAvailableRewards(profile, SEASON.until - 1);
    expect(all.claimed).toHaveLength(SEASON_REWARDS.length);
    expect(isOwned(all, 'car', 'cosmic')).toBe(true);
    const state = seasonProgress(all, SEASON.until - 1);
    expect(state.completed).toBe(true);
    expect(state.next).toBeNull();
    expect(state.totalPercent).toBe(100);
    expect(state.claimable).toHaveLength(0);
    expect(seasonProgress(all, SEASON.until).active).toBe(false);
    expect(seasonProgress(all, SEASON.until).remainingDays).toBe(0);
  });
});


describe('higher-difficulty free battle pass preserves prior purchases and reward claims', () => {
  it('sets monotonically increasing goals, requiring sustained play for top rewards', () => {
    expect(SEASON_REWARDS.map(x => x.xp)).toEqual([350,850,1650,2800,4200,5900,8000,10500]);
    expect(SEASON_REWARDS[7].xp).toBeGreaterThan(9000);
    expect(SEASON_REWARDS.every((reward,i) => i === 0 || reward.xp > SEASON_REWARDS[i-1].xp)).toBe(true);
    const firstRace = raceReward(starterProfile(), {
      wpm: 90, accuracy: 99, elapsedMs: 26_000, at: SEASON.from + 3600_000
    });
    expect(firstRace.seasonXp).toBeLessThan(SEASON_REWARDS[0].xp);
    expect(seasonProgress(firstRace, SEASON.from + 3600_000).claimable).toHaveLength(0);
  });
  it('grandfathers previously claimed rewards without revoking inventory or allowing double claim', () => {
    const existing = { ...starterProfile(), seasonXp: 1800, claimed: [1,2,3,4,5,6,7],
      coins: 670, owned: ['car:dawn','car:khan','trail:aurora','sticker:star','title:khan'] };
    const info = seasonProgress(existing, SEASON.from + 1000);
    expect(info.unlocked.map(x=>x.tier)).toEqual([1,2,3,4,5,6,7]);
    expect(info.claimable).toHaveLength(0);
    expect(info.focused.tier).toBe(8);
    expect(claimAvailableRewards(existing,SEASON.from + 1000)).toBe(existing);
    expect(claimReward(existing, 7, SEASON.from + 1000)).toBe(existing);
    expect(existing.owned).toContain('car:khan');
  });
});


describe('quickplay post-race rewards, Mongolian day quests and streak', () => {
  const day = Date.parse('2026-10-11T10:00:00+08:00');
  it('normalizes Mongolia local dates at the UTC boundary', () => {
    expect(mongoliaDayKey(Date.parse('2026-10-10T18:00:00Z'))).toBe('2026-10-11');
    expect(mongoliaDayKey(Date.parse('2026-10-11T15:59:00Z'))).toBe('2026-10-11');
    expect(mongoliaDayKey(Date.parse('2026-10-11T16:00:00Z'))).toBe('2026-10-12');
  });
  it('awards real completed race once, and claims mission coins exactly once', () => {
    const initial = starterProfile();
    const input = {raceId:'12345678-1234-4123-8123-123456789abc',place:1,coins:30,
      wpm:88,accuracy:99,elapsedMs:25000,at:day};
    const won = awardQuickRace(initial,input);
    expect(won.races).toBe(1);
    expect(won.history[0].earnedCoins).toBe(30);
    expect(awardQuickRace(won,input)).toBe(won);
    const quests = dailyQuests(won,day);
    expect(quests.map(q=>q.done)).toEqual([true,false,false]);
    const claimed = claimDailyQuest(won,'first-finish',day);
    expect(claimed.coins).toBe(won.coins+8);
    expect(claimDailyQuest(claimed,'first-finish',day)).toBe(claimed);
    expect(claimDailyQuest(won,'first-finish',day-86400000)).toBe(won);
    expect(quickDayStreak(won,day)).toBe(1);
  });
  it('caps credits at the NEW server amount instead of trusting old/forged 120-coin results', () => {
    const first=starterProfile();
    const reference={raceId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      place:1,coins:30,wpm:85,accuracy:98,elapsedMs:29_000,at:day};
    const actual=awardQuickRace(first,reference);
    expect(actual.coins).toBe(first.coins+30);
    expect(actual.history[0].earnedCoins).toBe(30);
    expect(awardQuickRace(first,{...reference,coins:120})).toBe(first);
    expect(awardQuickRace(actual,reference)).toBe(actual);
  });
  it('unfinished race cannot earn XP or quests; streak crosses Mongolia midnight', () => {
    const first = starterProfile();
    const unfinished = awardQuickRace(first,{raceId:'12345678-1234-4123-8123-123456789abc',
      place:null,coins:0,wpm:66,accuracy:93,elapsedMs:90000,at:day});
    expect(unfinished).toBe(first);
    expect(dailyQuests(first,day).every(q=>!q.done)).toBe(true);
    const yesterday = awardQuickRace(first,{raceId:'12345678-1234-4123-8123-123456789aaa',
      place:3,coins:24,wpm:65,accuracy:96,elapsedMs:30000,at:day-86400000});
    const today = awardQuickRace(yesterday,{raceId:'12345678-1234-4123-8123-123456789aab',
      place:2,coins:27,wpm:76,accuracy:92,elapsedMs:27000,at:day});
    expect(quickDayStreak(today,day)).toBe(2);
    expect(dailyQuests(today,day).find(q=>q.id==='precision')?.done).toBe(false);
    expect(dailyQuests(today,day).find(q=>q.id==='speed')?.done).toBe(false);
  });
});
