import type { Profile } from './progression';
import { premiumCosmeticAllowed, type PaidWallet } from '@typeracer/shared';
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const messages: Record<string, string> = {
  already_owned: 'Дэмжигчийн багцыг та аль хэдийн авсан байна.',
  account_protection_required: 'Профайлаа холбоно уу эсвэл сэргээх кодоо хадгалаад дахин оролдоно уу.',
  wire_authentication_failed: 'Wire API key хүчингүй байна. Эзэмшигч тохиргоогоо шалгана уу.',
  wire_invalid_response: 'Wire-ээс хариу авч чадсангүй. Түр хүлээгээд дахин оролдоно уу.',
  payments_not_configured: 'Төлбөрийн холболт хараахан бэлэн болоогүй байна.',
  connector_required: 'Төлбөрийн сувгийг Wire дээр идэвхжүүлэх шаардлагатай.',
  settlement_account_required: 'Wire дээр орлого хүлээн авах дансаа холбоно уу.',
  session_required: 'Хуудсаа дахин нээгээд оролдоно уу.',
  rate_limit_exceeded: 'Түр хүлээгээд дахин оролдоно уу.',
  insufficient_coins: 'Цэнэглэсэн зоос хүрэлцэхгүй байна.',
  order_not_found: 'Энэ төлбөр өөр бүртгэлд хамаарах эсвэл олдсонгүй.'
};
export async function paymentApi<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(API + '/api/payments/' + path, {
    credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
  });
  const value = await response.json();
  if (!response.ok) throw new Error(messages[value.error] ?? 'Төлбөрийн үйлчилгээтэй холбогдож чадсангүй. Дахин оролдоно уу.');
  return value as T;
}
let session: Promise<void> | undefined;
export function paymentSession() {
  return session ??= fetch(API + '/api/account', { credentials: 'same-origin', signal:AbortSignal.timeout(3000) }).then(response => {
    if (!response.ok) throw new Error('Бүртгэлтэй холбогдож чадсангүй.');
  }).catch(error => { session = undefined; throw error; });
}
export const emptyWallet = (): PaidWallet => ({ balance: 0, owned: [], recent: [] });

export function withPaidInventory(profile: Profile, wallet: PaidWallet): Profile {
  const owned = [...new Set([...profile.owned.filter(key => {
    const [kind,id] = key.split(':'); return premiumCosmeticAllowed(kind, id, wallet.owned);
  }), ...wallet.owned])];
  return { ...profile, owned,
    trail: premiumCosmeticAllowed('trail', profile.trail, wallet.owned) ? profile.trail : 'none',
    title: premiumCosmeticAllowed('title', profile.title, wallet.owned) ? profile.title : 'rookie',
    sticker: premiumCosmeticAllowed('sticker', profile.sticker, wallet.owned) ? profile.sticker : 'none'
  };
}
