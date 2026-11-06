import { SHOP, type CosmeticKind, type Cosmetic } from '@typeracer/shared';
export { SHOP, type CosmeticKind, type Cosmetic } from '@typeracer/shared';
import { CARS, RARITIES, type Skin } from './pages/cars';

export type Trail = 'none' | 'ember' | 'steppe' | 'ice' | 'aurora';
export type Title = 'rookie' | 'swift' | 'khan' | 'legend';
export type Sticker = 'none' | 'horse' | 'bolt' | 'star';
/** A deterministic daily and weekly spotlight; items never disappear from the full catalog. */
export const NEW_CAR_COLLECTION = SHOP.filter(item => item.kind === 'car' && item.minLevel !== undefined);
export function playerLevel(xp: number): number {
  return Math.floor(Math.max(0, xp) / 300) + 1;
}
export function isLevelUnlocked(profile: Pick<Profile, 'xp'>, item: Cosmetic): boolean {
  return playerLevel(profile.xp) >= (item.minLevel ?? 1);
}
export function shopRotation(at = Date.now()) {
  const day = Math.floor((at + 8 * 60 * 60_000) / 86_400_000);
  const week = Math.floor(day / 7);
  // Stable real local-date rotation: the same selection for all users in Mongolia.
  const featured = [NEW_CAR_COLLECTION[week % NEW_CAR_COLLECTION.length],
    NEW_CAR_COLLECTION[(week + 9) % NEW_CAR_COLLECTION.length]];
  const daily = [NEW_CAR_COLLECTION[(day * 3 + 2) % NEW_CAR_COLLECTION.length],
    NEW_CAR_COLLECTION[(day * 3 + 7) % NEW_CAR_COLLECTION.length],
    NEW_CAR_COLLECTION[(day * 3 + 12) % NEW_CAR_COLLECTION.length]];
  return { featured, daily, day };
}
export const COLLECTION_RARITIES = RARITIES;

export const ITEMS: Cosmetic[] = [
  ...SHOP,
  { id: 'khan', kind: 'car', name: 'Хааны хүлэг', description: 'Улирлын онцгой машин', price: 0, rarity: 'Домогт', preview: '/cars/khan.webp' },
  { id: 'dawn', kind: 'car', name: 'Үүрийн гэгээ', description: 'Нар мандах үеийн хүлэг', price: 0, rarity: 'Ховор', preview: '/cars/dawn.webp' },
  { id: 'cosmic', kind: 'car', name: 'Оддын зам', description: 'Улирлын эцсийн шагнал', price: 0, rarity: 'Домогт', preview: '/cars/cosmic.webp' },
  { id: 'aurora', kind: 'trail', name: 'Туяан мөр', description: 'Улирлын туяа', price: 0, rarity: 'Домогт', preview: '✦' },
  { id: 'khan', kind: 'title', name: 'Талын хаан', description: 'Онцгой цол', price: 0, rarity: 'Домогт', preview: 'ТАЛЫН ХААН' },
  { id: 'legend', kind: 'title', name: 'Бичгийн мастер', description: 'Эцсийн шатны цол', price: 0, rarity: 'Домогт', preview: 'БИЧГИЙН МАСТЕР' },
  { id: 'star', kind: 'sticker', name: 'Од', description: 'Нэрийн чимэглэл', price: 0, rarity: 'Ховор', preview: '✦' }
];
export const itemKey = (kind: CosmeticKind, id: string) => kind + ':' + id;
export const getItem = (kind: CosmeticKind, id: string) => ITEMS.find(x => x.kind === kind && x.id === id);
export const SEASON = {
  id: 'first-start-2026', name: 'ЭХНИЙ ГАРАА', from: Date.parse('2026-10-01T00:00:00+08:00'),
  until: Date.parse('2026-12-01T00:00:00+08:00')
};
export type SeasonReward = { tier: number; xp: number; coins?: number; kind?: CosmeticKind; itemId?: string };
/** Eight earned, free milestones spread across ~100 normal race finishes,
 * instead of all unlocking in ~23 finishes. Claims from the previous easier
 * schedule are grandfathered; no existing rewards or inventory are revoked.
 */
export const SEASON_REWARDS: SeasonReward[] = [
  { tier: 1, xp: 350, coins: 120 },
  { tier: 2, xp: 850, kind: 'sticker', itemId: 'star' },
  { tier: 3, xp: 1650, kind: 'car', itemId: 'dawn' },
  { tier: 4, xp: 2800, coins: 350 },
  { tier: 5, xp: 4200, kind: 'trail', itemId: 'aurora' },
  { tier: 6, xp: 5900, kind: 'title', itemId: 'khan' },
  { tier: 7, xp: 8000, kind: 'car', itemId: 'khan' },
  { tier: 8, xp: 10500, kind: 'car', itemId: 'cosmic' }
];
/** A consistent source of truth for the free season pass UI. The total XP is
 * preserved across all eight tiers and all claims remain explicitly time-gated.
 */
export function seasonProgress(profile: Pick<Profile, 'seasonXp' | 'claimed'>, at = Date.now()) {
  const active = at >= SEASON.from && at < SEASON.until;
  const remainingDays = active ? Math.ceil((SEASON.until - at) / 86_400_000) : 0;
  const last = SEASON_REWARDS[SEASON_REWARDS.length - 1];
  // Previously claimed milestones remain earned even after raising XP goals.
  const unlocked = SEASON_REWARDS.filter(reward =>
    profile.seasonXp >= reward.xp || profile.claimed.includes(reward.tier));
  const claimable = active ? SEASON_REWARDS.filter(reward =>
    profile.seasonXp >= reward.xp && !profile.claimed.includes(reward.tier)) : [];
  const next = SEASON_REWARDS.find(reward =>
    profile.seasonXp < reward.xp && !profile.claimed.includes(reward.tier)) ?? null;
  const previousXp = next ? (SEASON_REWARDS[next.tier - 2]?.xp ?? 0) : last.xp;
  const targetXp = next?.xp ?? last.xp;
  const segmentPercent = next
    ? Math.round(Math.max(0, Math.min(100, ((profile.seasonXp - previousXp) / Math.max(1, targetXp - previousXp)) * 100)))
    : 100;
  return {
    active, remainingDays, unlocked, claimable, next, previousXp, targetXp,
    xpToNext: next ? Math.max(0, next.xp - profile.seasonXp) : 0,
    segmentPercent, totalPercent: Math.min(100, Math.max(0, profile.seasonXp / last.xp * 100)),
    completed: SEASON_REWARDS.every(reward => profile.claimed.includes(reward.tier)),
    focused: claimable[0] ?? next ?? last,
  };
}

export type RaceHistory = { id: string; wpm: number; accuracy: number; elapsedMs: number; at: number; earnedXp: number; earnedCoins: number };
export type Profile = {
  xp: number; coins: number; races: number; seasonXp: number; claimed: number[];
  owned: string[]; car: Skin; trail: Trail; title: Title; sticker: Sticker;
  history: RaceHistory[];
  /** Device-local, non-transferable daily mission claims. */
  questClaims: string[];
};
const STORE_KEY = 'racer.profile.v1';
function safeNumber(n: unknown, fallback = 0) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1e8, Math.floor(n))) : fallback; }
export function starterProfile(): Profile {
  return { xp: 0, coins: 200, races: 0, seasonXp: 0, claimed: [], owned: [],
    car: 'sunset', trail: 'none', title: 'rookie', sticker: 'none', history: [], questClaims: [] };
}
function owned(p: Profile, kind: CosmeticKind, id: string): boolean {
  if (kind === 'car' && ['mint', 'sunset', 'purple', 'lime', 'phantom'].includes(id))
    return p.xp >= CARS[id as Skin].unlockAt;
  if (kind === 'trail' && id === 'none') return true;
  if (kind === 'title' && id === 'rookie') return true;
  if (kind === 'sticker' && id === 'none') return true;
  return p.owned.includes(itemKey(kind, id));
}
export function isOwned(p: Profile, kind: CosmeticKind, id: string) { return owned(p, kind, id); }
export function loadProfile(): Profile {
  const initial = starterProfile();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const oldXp = Number(localStorage.getItem('racer.xp')) || 0;
      const oldCar = localStorage.getItem('racer.skin');
      initial.xp = safeNumber(oldXp);
      if (oldCar && oldCar in CARS && initial.xp >= CARS[oldCar as Skin].unlockAt) initial.car = oldCar as Skin;
      return initial;
    }
    const x = JSON.parse(raw) as Partial<Profile>;
    if (!x || typeof x !== 'object') return initial;
    const profile: Profile = {
      ...initial, xp: safeNumber(x.xp), coins: safeNumber(x.coins),
      races: safeNumber(x.races), seasonXp: safeNumber(x.seasonXp),
      claimed: Array.isArray(x.claimed) ? x.claimed.filter(v => SEASON_REWARDS.some(r => r.tier === v)) : [],
      owned: Array.isArray(x.owned) ? x.owned.filter(v => typeof v === 'string' && ITEMS.some(i => itemKey(i.kind, i.id) === v)) : [],
      history: Array.isArray(x.history) ? x.history.filter((v): v is RaceHistory => !!v && typeof v.wpm === 'number').slice(0, 30) : [],
      questClaims: Array.isArray(x.questClaims) ? x.questClaims.filter((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}:(first-finish|precision|speed)$/.test(v)).slice(-120) : [],
      car: x.car && x.car in CARS ? x.car : initial.car,
      trail: x.trail && ['none','ember','steppe','ice','aurora'].includes(x.trail) ? x.trail : initial.trail,
      title: x.title && ['rookie','swift','khan','legend'].includes(x.title) ? x.title : initial.title,
      sticker: x.sticker && ['none','horse','bolt','star'].includes(x.sticker) ? x.sticker : initial.sticker
    };
    if (!owned(profile, 'car', profile.car)) profile.car = 'sunset';
    if (!owned(profile, 'trail', profile.trail)) profile.trail = 'none';
    if (!owned(profile, 'title', profile.title)) profile.title = 'rookie';
    if (!owned(profile, 'sticker', profile.sticker)) profile.sticker = 'none';
    return profile;
  } catch { return initial; }
}
export function saveProfile(profile: Profile): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(profile)); } catch { /* storage disabled */ }
}
export function raceReward(p: Profile, score: { wpm: number; accuracy: number; elapsedMs: number; at: number }): Profile {
  if (!Number.isFinite(score.wpm) || score.wpm < 0 || score.accuracy < 0 || score.accuracy > 100 || score.elapsedMs <= 0) return p;
  const earnedXp = Math.max(25, Math.min(160, Math.round(score.wpm * .6 + score.accuracy * .45)));
  // Solo practice: ~20–30 coins for normal human speeds. XP is unchanged
  // so an already-launched season remains achievable at its stated pace.
  const earnedCoins = Math.max(12, Math.min(30, Math.round(9 + score.wpm * .15 + score.accuracy * .055)));
  const entry: RaceHistory = { id: String(score.at) + '-' + p.races, wpm: score.wpm, accuracy: score.accuracy, elapsedMs: score.elapsedMs,
    at: score.at, earnedXp, earnedCoins };
  const inSeason = score.at >= SEASON.from && score.at < SEASON.until;
  return { ...p, xp: p.xp + earnedXp, coins: p.coins + earnedCoins, races: p.races + 1,
    seasonXp: p.seasonXp + (inSeason ? earnedXp : 0), history: [entry, ...p.history].slice(0, 30) };
}
/** Guest quick-race prizes. Result is server-computed but localStorage remains editable;
 * do not treat this as a secure ranked or transferable account wallet.
 */
export function awardQuickRace(p: Profile, score: {
  raceId: string; place: number | null; coins: number; wpm: number;
  accuracy: number; elapsedMs: number; at: number
}): Profile {
  const key = 'quick:' + score.raceId;
  if (!/^[0-9a-f-]{36}$/i.test(score.raceId) || p.history.some(entry => entry.id === key) ||
      score.place === null || score.place < 1 || score.place > 5 || !Number.isInteger(score.coins) ||
      score.coins < 0 || score.coins > 30 || score.elapsedMs <= 0 || score.wpm < 0 ||
      !Number.isFinite(score.wpm) || score.accuracy < 0 || score.accuracy > 100) return p;
  const awarded = raceReward(p, score);
  return { ...awarded, coins: p.coins + score.coins, history: [
    { ...awarded.history[0], id: key, earnedCoins: score.coins }, ...awarded.history.slice(1)
  ] };
}
export function buyItem(p: Profile, kind: CosmeticKind, id: string): Profile {
  const item = SHOP.find(x => x.kind === kind && x.id === id);
  if (!item || owned(p, kind, id) || !isLevelUnlocked(p, item) || p.coins < item.price) return p;
  return { ...p, coins: p.coins - item.price, owned: [...p.owned, itemKey(kind, id)] };
}
export function claimReward(p: Profile, tier: number, at: number = Date.now()): Profile {
  const reward = SEASON_REWARDS.find(x => x.tier === tier);
  if (!reward || p.claimed.includes(tier) || p.seasonXp < reward.xp || at < SEASON.from || at >= SEASON.until) return p;
  const addition = reward.kind && reward.itemId ? itemKey(reward.kind, reward.itemId) : null;
  return { ...p, claimed: [...p.claimed, tier], coins: p.coins + (reward.coins || 0),
    owned: addition && !p.owned.includes(addition) ? [...p.owned, addition] : p.owned };
}
/** Claim every currently earned free tier in one atomic profile update. */
export function claimAvailableRewards(profile: Profile, at = Date.now()): Profile {
  if (at < SEASON.from || at >= SEASON.until) return profile;
  return SEASON_REWARDS.reduce((result, reward) => claimReward(result, reward.tier, at), profile);
}
export function equipItem(p: Profile, kind: CosmeticKind, id: string): Profile {
  if (!owned(p, kind, id)) return p;
  if (kind === 'car' && id in CARS) return { ...p, car: id as Skin };
  if (kind === 'trail' && ['none','ember','steppe','ice','aurora'].includes(id)) return { ...p, trail: id as Trail };
  if (kind === 'title' && ['rookie','swift','khan','legend'].includes(id)) return { ...p, title: id as Title };
  if (kind === 'sticker' && ['none','horse','bolt','star'].includes(id)) return { ...p, sticker: id as Sticker };
  return p;
}
export const TRAIL_NAMES: Record<Trail,string> = { none: 'Мөргүй', ember: 'Галын мөр', steppe: 'Салхин мөр', ice: 'Мөсөн мөр', aurora: 'Туяан мөр' };
export const TITLE_NAMES: Record<Title,string> = { rookie: 'Шинэ уралдагч', swift: 'Түргэн хуруу', khan: 'Талын хаан', legend: 'Бичгийн мастер' };
export const STICKER_SYMBOLS: Record<Sticker,string> = { none: '', horse: '♞', bolt: 'ϟ', star: '✦' };

/** Guest-only missions are calculated from recorded completed quick races; there
 * are no fabricated lifetime milestones or paid/random rewards.
 */
export const DAILY_QUESTS = [
  { id: 'first-finish', name: 'Эхний бариа', detail: 'Өнөөдөр нэг уралдаан дуусгах', target: 1, coins: 8 },
  { id: 'precision', name: 'Нямбай жолооч', detail: '95%-ийн нарийвчлалтай 3 уралдаан дуусгах', target: 3, coins: 12 },
  { id: 'speed', name: 'Хурдны сорилт', detail: '70 WPM-ээс хурдан 5 уралдаан дуусгах', target: 5, coins: 15 }
] as const;
export type DailyQuestId = (typeof DAILY_QUESTS)[number]['id'];

/** Mongolia local calendar date. Explicit TZ avoids server/visitor TZ drift. */
export function mongoliaDayKey(at: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(at));
  const value = (part: string) => parts.find(p => p.type === part)?.value ?? '';
  return value('year') + '-' + value('month') + '-' + value('day');
}
export function dailyQuests(profile: Pick<Profile, 'history' | 'questClaims'>, at = Date.now()) {
  const day = mongoliaDayKey(at);
  const races = profile.history.filter(h => h.id.startsWith('quick:') && mongoliaDayKey(h.at) === day);
  const completed = {
    'first-finish': races.length,
    precision: races.filter(h => h.accuracy >= 95).length,
    speed: races.filter(h => h.wpm >= 70).length
  };
  return DAILY_QUESTS.map(quest => ({
    ...quest, progress: Math.min(quest.target, completed[quest.id]),
    done: completed[quest.id] >= quest.target,
    claimed: profile.questClaims.includes(day + ':' + quest.id)
  }));
}
/** Idempotent browser-local reward for a completed goal; no client-side purchase. */
export function claimDailyQuest(profile: Profile, id: DailyQuestId, at = Date.now()): Profile {
  const quest = dailyQuests(profile, at).find(q => q.id === id);
  if (!quest || !quest.done || quest.claimed) return profile;
  return { ...profile, coins: profile.coins + quest.coins,
    questClaims: [...profile.questClaims, mongoliaDayKey(at) + ':' + id].slice(-120) };
}
/** Consecutive days with at least one recorded quick finish, in Mongolia time. */
export function quickDayStreak(profile: Pick<Profile, 'history'>, at = Date.now()): number {
  const days = new Set(profile.history.filter(h => h.id.startsWith('quick:')).map(h => mongoliaDayKey(h.at)));
  let lookBack = days.has(mongoliaDayKey(at)) ? 0 : 1;
  let count = 0;
  while (days.has(mongoliaDayKey(at - lookBack * 86_400_000))) {
    count++;
    lookBack++;
  }
  return count;
}
