export type CosmeticKind = 'car' | 'trail' | 'title' | 'sticker';
export type Cosmetic = {
  id: string; kind: CosmeticKind; name: string; description: string;
  price: number; rarity: 'Энгийн' | 'Сайжруулсан' | 'Ховор' | 'Онцгой' | 'Туульс' | 'Домогт'; preview: string; minLevel?: number; effect?: string;
};
export const SHOP: Cosmetic[] = [
  { id: 'falcon', kind: 'car', name: 'Шонхор GT', description: 'Хөх өнгийн салхин зурвас', price: 300, rarity: 'Энгийн', minLevel: 1, preview: '/cars/falcon.webp', effect: 'breeze' },
  { id: 'nomad', kind: 'car', name: 'Говийн нүүдэл', description: 'Элсний тоосон эффект', price: 350, rarity: 'Энгийн', minLevel: 1, preview: '/cars/nomad.webp', effect: 'dust' },
  { id: 'rover', kind: 'car', name: 'Хотын эргүүл', description: 'Хотын гэрлийн цохилт', price: 400, rarity: 'Энгийн', minLevel: 2, preview: '/cars/rover.webp', effect: 'pulse' },
  { id: 'sunflare', kind: 'car', name: 'Нарны ир', description: 'Нарны гялбаа', price: 550, rarity: 'Сайжруулсан', minLevel: 3, preview: '/cars/sunflare.webp', effect: 'flare' },
  { id: 'dune', kind: 'car', name: 'Элсний шувуу', description: 'Говийн хурдны тоосон мөр', price: 650, rarity: 'Сайжруулсан', minLevel: 4, preview: '/cars/dune.webp', effect: 'dust' },
  { id: 'cobalt', kind: 'car', name: 'Кобальт X', description: 'Цэнхэр импульс гэрэл', price: 750, rarity: 'Сайжруулсан', minLevel: 5, preview: '/cars/cobalt.webp', effect: 'pulse' },
  { id: 'glacier', kind: 'car', name: 'Мөсөн барс', description: 'Хүйтэн цэнхэр манан', price: 850, rarity: 'Ховор', minLevel: 6, preview: '/cars/glacier.webp', effect: 'frost' },
  { id: 'fox', kind: 'car', name: 'Цасан үнэг', description: 'Цасан дундах салхи', price: 950, rarity: 'Ховор', minLevel: 7, preview: '/cars/fox.webp', effect: 'breeze' },
  { id: 'streak', kind: 'car', name: 'Аянгын судал', description: 'Ногоон цахилгаан оч', price: 1100, rarity: 'Ховор', minLevel: 8, preview: '/cars/streak.webp', effect: 'spark' },
  { id: 'ghost', kind: 'car', name: 'Хий үзэгдэл', description: 'Нил ягаан сүүдрийн гэрэл', price: 1350, rarity: 'Онцгой', minLevel: 10, preview: '/cars/ghost.webp', effect: 'shadow' },
  { id: 'onyx', kind: 'car', name: 'Оникс сүүдэр', description: 'Тод ба бараан сүүдрийн хөдөлгөөн', price: 1550, rarity: 'Онцгой', minLevel: 12, preview: '/cars/onyx.webp', effect: 'shadow' },
  { id: 'meteor', kind: 'car', name: 'Солир 77', description: 'Улаан солирын оч', price: 1750, rarity: 'Онцгой', minLevel: 14, preview: '/cars/meteor.webp', effect: 'spark' },
  { id: 'temple', kind: 'car', name: 'Алтан хүрд', description: 'Алтан цагираг гэрэл', price: 2100, rarity: 'Туульс', minLevel: 17, preview: '/cars/temple.webp', effect: 'halo' },
  { id: 'nebula', kind: 'car', name: 'Одон манан', description: 'Сансрын оддын туяа', price: 2500, rarity: 'Туульс', minLevel: 20, preview: '/cars/nebula.webp', effect: 'cosmos' },
  { id: 'eagle', kind: 'car', name: 'Далавчит бүргэд', description: 'Бүргэдийн алтан туяа', price: 2900, rarity: 'Туульс', minLevel: 23, preview: '/cars/eagle.webp', effect: 'halo' },
  { id: 'royal', kind: 'car', name: 'Тэнгэрийн титэм', description: 'Тэнгэрийн титэм гэрэл', price: 3500, rarity: 'Домогт', minLevel: 26, preview: '/cars/royal.webp', effect: 'royal' },
  { id: 'aurora-x', kind: 'car', name: 'Туйлын туяа', description: 'Туйлын солонгорсон туяа', price: 4200, rarity: 'Домогт', minLevel: 30, preview: '/cars/aurora-x.webp', effect: 'cosmos' },
  { id: 'dragon', kind: 'car', name: 'Лууны дөл', description: 'Лууны галын гэрэлтэх мөр', price: 5000, rarity: 'Домогт', minLevel: 35, preview: '/cars/dragon.webp', effect: 'flare' },
  { id: 'steppe', kind: 'car', name: 'Талын салхи', description: 'Тал нутгийн цэнхэр хүлэг', price: 550, rarity: 'Ховор', preview: '/cars/steppe.webp' },
  { id: 'thunder', kind: 'car', name: 'Аянга', description: 'Цахилгаан хурдны машин', price: 850, rarity: 'Ховор', preview: '/cars/thunder.webp' },
  { id: 'midnight', kind: 'car', name: 'Шөнийн хүлэг', description: 'Хар хром өнгөтэй хүлэг', price: 1400, rarity: 'Домогт', preview: '/cars/midnight.webp' },
  { id: 'ember', kind: 'trail', name: 'Галын мөр', description: 'Улаан очтой уралдааны мөр', price: 120, rarity: 'Энгийн', preview: '🔥' },
  { id: 'steppe', kind: 'trail', name: 'Салхин мөр', description: 'Талын салхины хөдөлгөөн', price: 240, rarity: 'Ховор', preview: '〰' },
  { id: 'ice', kind: 'trail', name: 'Мөсөн мөр', description: 'Хүйтэн цэнхэр туяа', price: 300, rarity: 'Ховор', preview: '❄' },
  { id: 'swift', kind: 'title', name: 'Түргэн хуруу', description: 'Нэрийн доор харагдах цол', price: 190, rarity: 'Энгийн', preview: 'ТҮРГЭН ХУРУУ' },
  { id: 'horse', kind: 'sticker', name: 'Хүлэг', description: 'Машины хажууд харагдах тэмдэг', price: 180, rarity: 'Энгийн', preview: '♞' },
  { id: 'bolt', kind: 'sticker', name: 'Аянга', description: 'Эрч хүчний тэмдэг', price: 220, rarity: 'Ховор', preview: 'ϟ' }
];
