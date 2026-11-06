/** Small live purchase for verifying the merchant integration. Amounts are whole MNT. */
export const COIN_PACKS = [
  { id: 'test-10', coins: 10, amount: 100, label: 'Туршилтын цэнэглэлт' }
] as const;
export type PaidWallet = { balance: number; owned: string[]; recent: Array<{
  id: string; coins: number; amount: number; status: string; credited: boolean;
}> };
