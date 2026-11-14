export type Skin = 'mint' | 'sunset' | 'purple' | 'lime' | 'phantom' | 'steppe' | 'thunder' | 'midnight' | 'khan' | 'dawn' | 'cosmic' | 'falcon' | 'nomad' | 'rover' | 'sunflare' | 'dune' | 'cobalt' | 'glacier' | 'fox' | 'streak' | 'ghost' | 'onyx' | 'meteor' | 'temple' | 'nebula' | 'eagle' | 'royal' | 'aurora-x' | 'dragon' | 'side-common-graphite' | 'side-uncommon-cobalt' | 'side-rare-lightning' | 'side-epic-violet' | 'side-mythic-emerald' | 'side-legend-cyber';
export const RARITIES = [
  { id: 'Энгийн', code: 'common', level: 1, color: '#aab9c4', description: 'Анхны гарааны хүлгүүд' },
  { id: 'Сайжруулсан', code: 'uncommon', level: 3, color: '#7cdea4', description: 'Шинэ хэв маяг, илүү тод өнгө' },
  { id: 'Ховор', code: 'rare', level: 6, color: '#74c3ff', description: 'Онцгой дизайн, гэрлийн мөр' },
  { id: 'Онцгой', code: 'epic', level: 10, color: '#c393ff', description: 'Хүчтэй өнгө, хөдөлгөөнт эффект' },
  { id: 'Туульс', code: 'mythic', level: 17, color: '#ffbd73', description: 'Домгийн хэв маягтай цуглуулга' },
  { id: 'Домогт', code: 'legendary', level: 26, color: '#f5de8d', description: 'Хамгийн ховор гэрэлтдэг хүлгүүд' }
] as const;
export type Rarity = (typeof RARITIES)[number]['id'];
export type CarSkin = { color: string; label: string; icon: string; unlockAt: number; rarity?: Rarity; effect?: string; modelType?: string };
export const CARS: Record<Skin, CarSkin> = {
  mint: { color: '#3679e8', label: 'Цэнхэр салхи', icon: '/cars/mint.webp', unlockAt: 0 },
  sunset: { color: '#fa5139', label: 'Улаан хурд', icon: '/cars/sunset.webp', unlockAt: 0 },
  purple: { color: '#c8cdd6', label: 'Хром хүлэг', icon: '/cars/purple.webp', unlockAt: 0 },
  lime: { color: '#c8e64a', label: 'Ногоон оч', icon: '/cars/lime.webp', unlockAt: 250 },
  phantom: { color: '#65666e', label: 'Сүүдэр', icon: '/cars/phantom.webp', unlockAt: 650 },
  steppe: { color: '#268ce5', label: 'Талын салхи', icon: '/cars/steppe.webp', unlockAt: 0 },
  thunder: { color: '#b8ed19', label: 'Аянга', icon: '/cars/thunder.webp', unlockAt: 0 },
  midnight: { color: '#69737f', label: 'Шөнийн хүлэг', icon: '/cars/midnight.webp', unlockAt: 0 },
  khan: { color: '#e9b643', label: 'Хааны хүлэг', icon: '/cars/khan.webp', unlockAt: 0 },
  dawn: { color: '#ff945e', label: 'Үүрийн гэгээ', icon: '/cars/dawn.webp', unlockAt: 0 },
  cosmic: { color: '#b17dfc', label: 'Оддын зам', icon: '/cars/cosmic.webp', unlockAt: 0 },
  'falcon': { color: '#2383d1', label: 'Шонхор GT', icon: '/cars/falcon.webp', unlockAt: 0, rarity: 'Энгийн', effect: 'breeze', modelType: 'Ретро ралли купе' },
  'nomad': { color: '#af8c49', label: 'Говийн нүүдэл', icon: '/cars/nomad.webp', unlockAt: 0, rarity: 'Энгийн', effect: 'dust', modelType: 'Өндөрлөг 4×4 жийп' },
  'rover': { color: '#96a6b2', label: 'Хотын эргүүл', icon: '/cars/rover.webp', unlockAt: 0, rarity: 'Энгийн', effect: 'pulse', modelType: 'Энгийн хотын седан' },
  'sunflare': { color: '#fa8c27', label: 'Нарны ир', icon: '/cars/sunflare.webp', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'flare', modelType: 'Булчинлаг дрэг машин' },
  'dune': { color: '#db9851', label: 'Элсний шувуу', icon: '/cars/dune.webp', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'dust', modelType: 'Элсний экспедицийн жийп' },
  'cobalt': { color: '#476ad8', label: 'Кобальт X', icon: '/cars/cobalt.webp', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'pulse', modelType: 'Цахилгаан спорт ван' },
  'glacier': { color: '#60bad7', label: 'Мөсөн барс', icon: '/cars/glacier.webp', unlockAt: 0, rarity: 'Ховор', effect: 'frost', modelType: 'Мөсөн гиперкар' },
  'fox': { color: '#e77b52', label: 'Цасан үнэг', icon: '/cars/fox.webp', unlockAt: 0, rarity: 'Ховор', effect: 'breeze', modelType: 'Цагаан алтан гиперкар' },
  'streak': { color: '#79b832', label: 'Аянгын судал', icon: '/cars/streak.webp', unlockAt: 0, rarity: 'Ховор', effect: 'spark', modelType: 'Нээлттэй Формула машин' },
  'ghost': { color: '#6963ab', label: 'Хий үзэгдэл', icon: '/cars/ghost.webp', unlockAt: 0, rarity: 'Онцгой', effect: 'shadow', modelType: 'Сүүдрийн гиперкар' },
  'onyx': { color: '#737a9e', label: 'Оникс сүүдэр', icon: '/cars/onyx.webp', unlockAt: 0, rarity: 'Онцгой', effect: 'shadow', modelType: 'Цэнхэр гэрэлт гиперкар' },
  'meteor': { color: '#e74d43', label: 'Солир 77', icon: '/cars/meteor.webp', unlockAt: 0, rarity: 'Онцгой', effect: 'spark', modelType: 'Галт спорт купе' },
  'temple': { color: '#cfa34a', label: 'Алтан хүрд', icon: '/cars/temple.webp', unlockAt: 0, rarity: 'Туульс', effect: 'halo', modelType: 'Алтан эрдэнийн гиперкар' },
  'nebula': { color: '#b86ae7', label: 'Одон манан', icon: '/cars/nebula.webp', unlockAt: 0, rarity: 'Туульс', effect: 'cosmos', modelType: 'Сансрын хээтэй гиперкар' },
  'eagle': { color: '#b9a457', label: 'Далавчит бүргэд', icon: '/cars/eagle.webp', unlockAt: 0, rarity: 'Туульс', effect: 'halo', modelType: 'Бүргэд хээтэй спорт машин' },
  'royal': { color: '#36cebc', label: 'Тэнгэрийн титэм', icon: '/cars/royal.webp', unlockAt: 0, rarity: 'Домогт', effect: 'royal', modelType: 'Цагаан алтан гиперкар' },
  'aurora-x': { color: '#67d4c3', label: 'Туйлын туяа', icon: '/cars/aurora-x.webp', unlockAt: 0, rarity: 'Домогт', effect: 'cosmos', modelType: 'Туйлын туяатай гиперкар' },
  'dragon': { color: '#db6258', label: 'Лууны дөл', icon: '/cars/dragon.webp', unlockAt: 0, rarity: 'Домогт', effect: 'flare', modelType: 'Лууны дөлтэй гиперкар' },
  'side-common-graphite': { color: '#3c4249', label: 'Графит Спринт', icon: '/cars/side-common-graphite.webp', unlockAt: 0, rarity: 'Энгийн', effect: 'breeze', modelType: 'Хар ралли хэтчбек · 2D хажуу харагдац' },
  'side-uncommon-cobalt': { color: '#286cff', label: 'Кобальт Спринт', icon: '/cars/side-uncommon-cobalt.webp', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'pulse', modelType: 'Цэнхэр спорт купе · 2D хажуу харагдац' },
  'side-rare-lightning': { color: '#145deb', label: 'Цахилгаан GT', icon: '/cars/side-rare-lightning.webp', unlockAt: 0, rarity: 'Ховор', effect: 'spark', modelType: 'Уралдааны купе · 2D хажуу харагдац' },
  'side-epic-violet': { color: '#a52bdc', label: 'Ягаан Сүүдэр', icon: '/cars/side-epic-violet.webp', unlockAt: 0, rarity: 'Онцгой', effect: 'shadow', modelType: 'Өргөн биетэй GT · 2D хажуу харагдац' },
  'side-mythic-emerald': { color: '#14a46f', label: 'Маргад Феникс', icon: '/cars/side-mythic-emerald.webp', unlockAt: 0, rarity: 'Туульс', effect: 'halo', modelType: 'Маргад гиперкар · 2D хажуу харагдац' },
  'side-legend-cyber': { color: '#aeeafb', label: 'Кибер Тэнгэр', icon: '/cars/side-legend-cyber.webp', unlockAt: 0, rarity: 'Домогт', effect: 'cosmos', modelType: 'Цагаан кибер гиперкар · 2D хажуу харагдац' }
};
export const carKeys = Object.keys(CARS) as Skin[];

/** Lightweight track art uses a separate 480px WebP for rapid multiplayer updates.
 * The same ID is sent over WebSockets; clients select image size locally. */
export function raceCarIcon(skin: Skin): string {
  return '/cars/race/' + skin + '.webp';
}
