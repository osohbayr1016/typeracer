import { useState } from 'react';
import { SHOP, isOwned, type CosmeticKind, type Profile, type Cosmetic } from '../progression';
type Props = { profile: Profile; onBuy: (item: Cosmetic) => void; onEquip: (item: Cosmetic) => void; onRace: () => void };
const tabs: { id: 'all' | CosmeticKind; label: string }[] = [
  { id:'all', label:'Бүгд' }, { id:'car', label:'Машин' }, { id:'trail', label:'Мөр' },
  { id:'title', label:'Цол' }, { id:'sticker', label:'Стикер' }
];
function isEquipped(profile: Profile, item: Cosmetic) {
  return item.kind === 'car' ? profile.car === item.id :
    item.kind === 'trail' ? profile.trail === item.id :
    item.kind === 'title' ? profile.title === item.id : profile.sticker === item.id;
}
export function ShopPage({ profile, onBuy, onEquip, onRace }: Props) {
  const [tab, setTab] = useState<'all' | CosmeticKind>('all');
  return <div className="collection-page">
    <div className="collection-heading">
      <div><span className="section-kicker">БЭЛЭГЛЭЛИЙН ДЭЛГҮҮР / УРАЛДАЖ ОЛ</span>
        <h1>ТОГЛООМЫН <span>ДЭЛГҮҮР.</span></h1>
        <p>Жинхэнэ мөнгө биш. Зөвхөн уралдаж олсон зоосоороо гоёлын зүйл аваарай.</p></div>
      <div className="coin-counter"><span>МИНИЙ ЗООС</span><strong>◈ {profile.coins.toLocaleString('mn-MN')}</strong></div>
    </div>
    <nav className="collection-tabs" aria-label="Барааны төрөл">
      {tabs.map(t => <button key={t.id} className={tab === t.id ? 'current' : ''} aria-pressed={tab === t.id}
        onClick={() => setTab(t.id)}>{t.label}</button>)}
    </nav>
    <div className="item-grid">
      {SHOP.filter(item => tab === 'all' || item.kind === tab).map(item => {
        const acquired = isOwned(profile, item.kind, item.id);
        const equipped = acquired && isEquipped(profile, item);
        return <article className="item-card" key={item.kind + item.id}>
          <div className="item-card-header"><span className="item-rarity">{item.rarity}</span><span>{item.kind === 'car' ? 'МАШИН' :
            item.kind === 'trail' ? 'МӨР' : item.kind === 'sticker' ? 'СТИКЕР' : 'ЦОЛ'}</span></div>
          <div className={'item-art ' + (item.kind !== 'car' ? 'item-symbol' : '')}>
            {item.kind === 'car' ? <img src={item.preview} alt={item.name} loading="lazy"/> : <span>{item.preview}</span>}
          </div>
          <h2>{item.name}</h2><p>{item.description}</p>
          <div className="item-action">
            <strong>{acquired ? 'ЦУГЛУУЛСАН' : '◈ ' + item.price}</strong>
            <button disabled={equipped || (!acquired && profile.coins < item.price)}
              onClick={() => acquired ? onEquip(item) : onBuy(item)}>
              {equipped ? '✓ Зүүсэн' : acquired ? 'Зүүх' : profile.coins < item.price ? 'Зоос хүрэхгүй' : 'Худалдан авах'}
            </button>
          </div>
        </article>;
      })}
    </div>
    <div className="reward-disclaimer">Энэ бол бодит мөнгө, мөрийтэй тоглоом, санамсаргүй хайрцаггүй туршилтын дэлгүүр.
      Одоогоор зоос, авсан зүйлс зөвхөн энэ төхөөрөмж дээр хадгалагдана.
      <button onClick={onRace}>Зоос олохын тулд уралдах →</button></div>
  </div>;
}
