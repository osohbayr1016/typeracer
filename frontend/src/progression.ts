import { CARS, type Skin } from './pages/cars';

export type CosmeticKind = 'car' | 'trail' | 'title' | 'sticker';
export type Trail = 'none' | 'ember' | 'steppe' | 'ice' | 'aurora';
export type Title = 'rookie' | 'swift' | 'khan' | 'legend';
export type Sticker = 'none' | 'horse' | 'bolt' | 'star';
export type Cosmetic = {
  id: string; kind: CosmeticKind; name: string; description: string;
  price: number; rarity: 'Энгийн' | 'Ховор' | 'Домогт'; preview: string;
};
export const SHOP: Cosmetic[] = [
  { id: 'steppe', kind: 'car', name: 'Талын салхи', description: 'Тал нутгийн цэнхэр хүлэг', price: 550, rarity: 'Ховор', preview: '/cars/steppe.svg' },
  { id: 'thunder', kind: 'car', name: 'Аянга', description: 'Цахилгаан хурдны машин', price: 850, rarity: 'Ховор', preview: '/cars/thunder.svg' },
  { id: 'midnight', kind: 'car', name: 'Шөнийн хүлэг', description: 'Хар хром өнгөтэй хүлэг', price: 1400, rarity: 'Домогт', preview: '/cars/midnight.svg' },
  { id: 'ember', kind: 'trail', name: 'Галын мөр', description: 'Улаан очтой уралдааны мөр', price: 120, rarity: 'Энгийн', preview: '🔥' },
  { id: 'steppe', kind: 'trail', name: 'Салхин мөр', description: 'Талын салхины хөдөлгөөн', price: 240, rarity: 'Ховор', preview: '〰' },
  { id: 'ice', kind: 'trail', name: 'Мөсөн мөр', description: 'Хүйтэн цэнхэр туяа', price: 300, rarity: 'Ховор', preview: '❄' },
  { id: 'swift', kind: 'title', name: 'Түргэн хуруу', description: 'Нэрийн доор харагдах цол', price: 190, rarity: 'Энгийн', preview: 'ТҮРГЭН ХУРУУ' },
  { id: 'horse', kind: 'sticker', name: 'Хүлэг', description: 'Машины хажууд харагдах тэмдэг', price: 180, rarity: 'Энгийн', preview: '♞' },
  { id: 'bolt', kind: 'sticker', name: 'Аянга', description: 'Эрч хүчний тэмдэг', price: 220, rarity: 'Ховор', preview: 'ϟ' }
];
export const ITEMS: Cosmetic[] = [
  ...SHOP,
  { id: 'khan', kind: 'car', name: 'Хааны хүлэг', description: 'Улирлын онцгой машин', price: 0, rarity: 'Домогт', preview: '/cars/khan.svg' },
  { id: 'dawn', kind: 'car', name: 'Үүрийн гэгээ', description: 'Нар мандах үеийн хүлэг', price: 0, rarity: 'Ховор', preview: '/cars/dawn.svg' },
  { id: 'cosmic', kind: 'car', name: 'Оддын зам', description: 'Улирлын эцсийн шагнал', price: 0, rarity: 'Домогт', preview: '/cars/cosmic.svg' },
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
export const SEASON_REWARDS: SeasonReward[] = [
  { tier: 1, xp: 100, coins: 120 },
  { tier: 2, xp: 240, kind: 'sticker', itemId: 'star' },
  { tier: 3, xp: 420, kind: 'car', itemId: 'dawn' },
  { tier: 4, xp: 660, coins: 350 },
  { tier: 5, xp: 960, kind: 'trail', itemId: 'aurora' },
  { tier: 6, xp: 1300, kind: 'title', itemId: 'khan' },
  { tier: 7, xp: 1750, kind: 'car', itemId: 'khan' },
  { tier: 8, xp: 2300, kind: 'car', itemId: 'cosmic' }
];
export type RaceHistory = { id: string; wpm: number; accuracy: number; elapsedMs: number; at: number; earnedXp: number; earnedCoins: number };
export type Profile = {
  xp: number; coins: number; races: number; seasonXp: number; claimed: number[];
  owned: string[]; car: Skin; trail: Trail; title: Title; sticker: Sticker;
  history: RaceHistory[];
};
const STORE_KEY = 'racer.profile.v1';
function safeNumber(n: unknown, fallback = 0) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1e8, Math.floor(n))) : fallback; }
export function starterProfile(): Profile {
  return { xp: 0, coins: 200, races: 0, seasonXp: 0, claimed: [], owned: [],
    car: 'sunset', trail: 'none', title: 'rookie', sticker: 'none', history: [] };
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
  const earnedCoins = Math.max(30, Math.min(110, Math.round(score.wpm * .45 + score.accuracy * .20)));
  const entry: RaceHistory = { id: String(score.at) + '-' + p.races, wpm: score.wpm, accuracy: score.accuracy, elapsedMs: score.elapsedMs,
    at: score.at, earnedXp, earnedCoins };
  const inSeason = score.at >= SEASON.from && score.at < SEASON.until;
  return { ...p, xp: p.xp + earnedXp, coins: p.coins + earnedCoins, races: p.races + 1,
    seasonXp: p.seasonXp + (inSeason ? earnedXp : 0), history: [entry, ...p.history].slice(0, 30) };
}
export function buyItem(p: Profile, kind: CosmeticKind, id: string): Profile {
  const item = SHOP.find(x => x.kind === kind && x.id === id);
  if (!item || owned(p, kind, id) || p.coins < item.price) return p;
  return { ...p, coins: p.coins - item.price, owned: [...p.owned, itemKey(kind, id)] };
}
export function claimReward(p: Profile, tier: number, at: number = Date.now()): Profile {
  const reward = SEASON_REWARDS.find(x => x.tier === tier);
  if (!reward || p.claimed.includes(tier) || p.seasonXp < reward.xp || at < SEASON.from || at >= SEASON.until) return p;
  const addition = reward.kind && reward.itemId ? itemKey(reward.kind, reward.itemId) : null;
  return { ...p, claimed: [...p.claimed, tier], coins: p.coins + (reward.coins || 0),
    owned: addition && !p.owned.includes(addition) ? [...p.owned, addition] : p.owned };
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
