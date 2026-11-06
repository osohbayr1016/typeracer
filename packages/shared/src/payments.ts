export type CoinProduct = {
  id: string; coins: number; amount: number; label: string; description: string;
  bonus?: number; testOnly?: boolean; oneTime?: boolean; grants?: readonly string[];
};
/** Server-owned prices, in whole MNT. Supporter is a one-time cosmetic purchase. */
export const COIN_PACKS: readonly CoinProduct[] = [
  { id: 'coins-200', coins: 200, amount: 1000, label: 'Эхний гараа', description: 'Дуртай гоёлоо сонгоорой.' },
  { id: 'coins-1100', coins: 1100, amount: 5000, bonus: 100, label: 'Хүлгийн сан', description: '1,000 зоос + 100 бонус зоос.' },
  { id: 'coins-2400', coins: 2400, amount: 10000, bonus: 400, label: 'Том цуглуулга', description: '2,000 зоос + 400 бонус зоос.' },
  { id: 'supporter', coins: 2000, amount: 9900, label: 'ДЭМЖИГЧ', oneTime: true,
    description: '2,000 зоос · Алтан мөр · Титэм тэмдэг · Дэмжигч цол. Нэг удаа авна, хугацаагүй.',
    grants: ['trail:gold', 'sticker:crown', 'title:supporter'] },
  { id: 'test-10', coins: 10, amount: 100, label: 'Туршилтын цэнэглэлт', description: 'Төлбөрийн холболтыг шалгах жижиг багц.', testOnly: true }
];
export type PaidReceipt = {
  id: string; coins: number; amount: number; status: string; credited: boolean;
  label?: string; createdAt?: number; grants?: string[];
};
export type PaidWallet = { balance: number; owned: string[]; playerId?: string; supporter?: boolean; linked?: boolean; recoveryReady?: boolean; recent: PaidReceipt[] };
export const SUPPORTER_COSMETICS = ['trail:gold', 'sticker:crown', 'title:supporter'] as const;
export function premiumCosmeticAllowed(kind: string, id: string, owned: readonly string[]) {
  const key = kind + ':' + id;
  return !(SUPPORTER_COSMETICS as readonly string[]).includes(key) || owned.includes(key);
}
