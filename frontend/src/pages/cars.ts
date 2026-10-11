export type Skin = 'mint' | 'sunset' | 'purple' | 'lime' | 'phantom' | 'steppe' | 'thunder' | 'midnight' | 'khan' | 'dawn' | 'cosmic' | 'falcon' | 'nomad' | 'rover' | 'sunflare' | 'dune' | 'cobalt' | 'glacier' | 'fox' | 'streak' | 'ghost' | 'onyx' | 'meteor' | 'temple' | 'nebula' | 'eagle' | 'royal' | 'aurora-x' | 'dragon';
export const RARITIES = [
  { id: 'Энгийн', code: 'common', level: 1, color: '#aab9c4', description: 'Анхны гарааны хүлгүүд' },
  { id: 'Сайжруулсан', code: 'uncommon', level: 3, color: '#7cdea4', description: 'Шинэ хэв маяг, илүү тод өнгө' },
  { id: 'Ховор', code: 'rare', level: 6, color: '#74c3ff', description: 'Онцгой дизайн, гэрлийн мөр' },
  { id: 'Онцгой', code: 'epic', level: 10, color: '#c393ff', description: 'Хүчтэй өнгө, хөдөлгөөнт эффект' },
  { id: 'Туульс', code: 'mythic', level: 17, color: '#ffbd73', description: 'Домгийн хэв маягтай цуглуулга' },
  { id: 'Домогт', code: 'legendary', level: 26, color: '#f5de8d', description: 'Хамгийн ховор гэрэлтдэг хүлгүүд' }
] as const;
export type Rarity = (typeof RARITIES)[number]['id'];
export type CarSkin = { color: string; label: string; icon: string; unlockAt: number; rarity?: Rarity; effect?: string };
export const CARS: Record<Skin, CarSkin> = {
  mint: { color: '#3679e8', label: 'Цэнхэр салхи', icon: '/cars/blue-sprint.svg', unlockAt: 0 },
  sunset: { color: '#fa5139', label: 'Улаан хурд', icon: '/cars/coral-gt.svg', unlockAt: 0 },
  purple: { color: '#c8cdd6', label: 'Хром хүлэг', icon: '/cars/graphite-r.svg', unlockAt: 0 },
  lime: { color: '#c8e64a', label: 'Ногоон оч', icon: '/cars/volt.svg', unlockAt: 250 },
  phantom: { color: '#65666e', label: 'Сүүдэр', icon: '/cars/phantom.svg', unlockAt: 650 },
  steppe: { color: '#268ce5', label: 'Талын салхи', icon: '/cars/steppe.svg', unlockAt: 0 },
  thunder: { color: '#b8ed19', label: 'Аянга', icon: '/cars/thunder.svg', unlockAt: 0 },
  midnight: { color: '#69737f', label: 'Шөнийн хүлэг', icon: '/cars/midnight.svg', unlockAt: 0 },
  khan: { color: '#e9b643', label: 'Хааны хүлэг', icon: '/cars/khan.svg', unlockAt: 0 },
  dawn: { color: '#ff945e', label: 'Үүрийн гэгээ', icon: '/cars/dawn.svg', unlockAt: 0 },
  cosmic: { color: '#b17dfc', label: 'Оддын зам', icon: '/cars/cosmic.svg', unlockAt: 0 },
  'falcon': { color: '#2383d1', label: 'Шонхор GT', icon: '/cars/falcon.svg', unlockAt: 0, rarity: 'Энгийн', effect: 'breeze' },
  'nomad': { color: '#af8c49', label: 'Говийн нүүдэл', icon: '/cars/nomad.svg', unlockAt: 0, rarity: 'Энгийн', effect: 'dust' },
  'rover': { color: '#96a6b2', label: 'Хотын эргүүл', icon: '/cars/rover.svg', unlockAt: 0, rarity: 'Энгийн', effect: 'pulse' },
  'sunflare': { color: '#fa8c27', label: 'Нарны ир', icon: '/cars/sunflare.svg', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'flare' },
  'dune': { color: '#db9851', label: 'Элсний шувуу', icon: '/cars/dune.svg', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'dust' },
  'cobalt': { color: '#476ad8', label: 'Кобальт X', icon: '/cars/cobalt.svg', unlockAt: 0, rarity: 'Сайжруулсан', effect: 'pulse' },
  'glacier': { color: '#60bad7', label: 'Мөсөн барс', icon: '/cars/glacier.svg', unlockAt: 0, rarity: 'Ховор', effect: 'frost' },
  'fox': { color: '#e77b52', label: 'Цасан үнэг', icon: '/cars/fox.svg', unlockAt: 0, rarity: 'Ховор', effect: 'breeze' },
  'streak': { color: '#79b832', label: 'Аянгын судал', icon: '/cars/streak.svg', unlockAt: 0, rarity: 'Ховор', effect: 'spark' },
  'ghost': { color: '#6963ab', label: 'Хий үзэгдэл', icon: '/cars/ghost.svg', unlockAt: 0, rarity: 'Онцгой', effect: 'shadow' },
  'onyx': { color: '#737a9e', label: 'Оникс сүүдэр', icon: '/cars/onyx.svg', unlockAt: 0, rarity: 'Онцгой', effect: 'shadow' },
  'meteor': { color: '#e74d43', label: 'Солир 77', icon: '/cars/meteor.svg', unlockAt: 0, rarity: 'Онцгой', effect: 'spark' },
  'temple': { color: '#cfa34a', label: 'Алтан хүрд', icon: '/cars/temple.svg', unlockAt: 0, rarity: 'Туульс', effect: 'halo' },
  'nebula': { color: '#b86ae7', label: 'Одон манан', icon: '/cars/nebula.svg', unlockAt: 0, rarity: 'Туульс', effect: 'cosmos' },
  'eagle': { color: '#b9a457', label: 'Далавчит бүргэд', icon: '/cars/eagle.svg', unlockAt: 0, rarity: 'Туульс', effect: 'halo' },
  'royal': { color: '#36cebc', label: 'Тэнгэрийн титэм', icon: '/cars/royal.svg', unlockAt: 0, rarity: 'Домогт', effect: 'royal' },
  'aurora-x': { color: '#67d4c3', label: 'Туйлын туяа', icon: '/cars/aurora-x.svg', unlockAt: 0, rarity: 'Домогт', effect: 'cosmos' },
  'dragon': { color: '#db6258', label: 'Лууны дөл', icon: '/cars/dragon.svg', unlockAt: 0, rarity: 'Домогт', effect: 'flare' }
};
export const carKeys = Object.keys(CARS) as Skin[];
