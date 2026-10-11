import './ShopPage.css';
import { useState } from 'react';
import { RARITIES, type Rarity } from './cars';
import { SHOP, NEW_CAR_COLLECTION, isOwned, isLevelUnlocked, playerLevel, shopRotation,
  type CosmeticKind, type Profile, type Cosmetic } from '../progression';

type Props = { profile: Profile; onBuy: (item: Cosmetic) => void; onEquip: (item: Cosmetic) => void; onRace: () => void };
const tabs: { id: 'all' | CosmeticKind; label: string }[] = [
  { id: 'all', label: 'Бүх зүйл' }, { id: 'car', label: 'Машин' }, { id: 'trail', label: 'Мөр' },
  { id: 'title', label: 'Цол' }, { id: 'sticker', label: 'Тэмдэг' }
];
function equipped(profile: Profile, item: Cosmetic) {
  return item.kind === 'car' ? profile.car === item.id :
    item.kind === 'trail' ? profile.trail === item.id :
    item.kind === 'title' ? profile.title === item.id : profile.sticker === item.id;
}
function classFor(item: Cosmetic) {
  const rarity = RARITIES.find(r => r.id === item.rarity);
  return 'rarity-' + (rarity?.code ?? 'common') + ' effect-' + (item.effect || 'none');
}
export function ShopPage({ profile, onBuy, onEquip, onRace }: Props) {
  const [tab, setTab] = useState<'all' | CosmeticKind>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const level = playerLevel(profile.xp);
  const rotation = shopRotation();
  const carsOwned = NEW_CAR_COLLECTION.filter(item => isOwned(profile, 'car', item.id)).length;
  const items = SHOP.filter(item => (tab === 'all' || item.kind === tab) &&
    (rarity === 'all' || item.kind === 'car' && item.rarity === rarity));

  function action(item: Cosmetic) {
    if (isOwned(profile, item.kind, item.id)) onEquip(item);
    else onBuy(item);
  }
  function actionText(item: Cosmetic) {
    if (isOwned(profile, item.kind, item.id)) return equipped(profile, item) ? '✓ Сонгосон' : 'Машинд суух / Зүүх';
    if (!isLevelUnlocked(profile, item)) return '🔒 ТҮВШИН ' + item.minLevel;
    if (profile.coins < item.price) return 'Зоос хүрэхгүй';
    return '◈ ХУДАЛДАН АВАХ';
  }
  function openCollection(item: Cosmetic) { setTab('car'); setRarity(item.rarity); }

  return <div className="collection-page rarity-shop">
    <header className="collection-heading">
      <div><span className="section-kicker">МОНГОЛ УРАЛДААН · 6 ЗЭРЭГЛЭЛ</span>
        <h1>ХҮЛГИЙН <span>ЦУГЛУУЛГА.</span></h1>
        <p>6 ховорын зэрэглэл · тус бүр 3 шинэ машин · өөрийн гэрлийн эффект. Уралдаж XP, зоос цуглуулаад нээгээрэй.</p>
      </div>
      <div className="shop-wallet">
        <div className="coin-counter"><span>МИНИЙ ЗООС</span><strong>◈ {profile.coins.toLocaleString('mn-MN')}</strong></div>
        <div className="shop-collection-progress">
          <span>ТҮВШИН {level} · ЦУГЛУУЛГА {carsOwned}/18</span>
          <div className="shop-meter" role="progressbar" aria-valuemin={0} aria-valuemax={18} aria-valuenow={carsOwned} aria-label="Шинэ машин цуглуулсан тоо">
            <span style={{ width: carsOwned / 18 * 100 + '%' }}/></div>
        </div>
      </div>
    </header>

    <div className="shop-spotlight-grid">
      <section className={'shop-featured '+classFor(rotation.featured[0])} aria-label="Долоо хоногийн онцлох машин">
        <div className="shop-featured-copy">
          <span className="shop-eyebrow">★ ДОЛОО ХОНОГИЙН ОНЦЛОХ</span>
          <h2>{rotation.featured[0].name}</h2>
          <p>{rotation.featured[0].description} · {rotation.featured[0].rarity}</p>
          <span className="shop-feature-meta">ТҮВШИН {rotation.featured[0].minLevel} · ◈ {rotation.featured[0].price.toLocaleString('mn-MN')}</span>
          <button type="button" onClick={() => openCollection(rotation.featured[0])}>ЦУГЛУУЛГААС ҮЗЭХ →</button>
        </div>
        <div className="shop-car-art shop-featured-car"><span className="car-aura" aria-hidden="true"/>
          <img src={rotation.featured[0].preview} alt={rotation.featured[0].name}/></div>
      </section>
      <section className="shop-daily" aria-labelledby="daily-items">
        <div className="shop-daily-head"><h2 id="daily-items">ӨНӨӨДРИЙН СОНГОЛТ</h2><span>Өдөр бүр шинэчлэгдэнэ</span></div>
        <div className="shop-daily-list">
          {rotation.daily.map(item => <button key={item.id} type="button" className={'shop-daily-item '+classFor(item)}
            onClick={() => openCollection(item)}>
            <span className="shop-car-art"><span className="car-aura" aria-hidden="true"/><img src={item.preview} alt=""/></span>
            <span className="shop-daily-name"><strong>{item.name}</strong><small>{item.rarity} · ТҮВШИН {item.minLevel}</small></span>
            <span aria-hidden="true">↗</span>
          </button>)}
        </div>
      </section>
    </div>
    <p className="shop-spotlight-note">Онцлох бараа солигдсон ч машинууд бүрэн каталогт байнга үлдэнэ. Санамсаргүй хайрцаг, бодит мөнгө байхгүй.</p>

    <div className="shop-catalog-head"><div><span className="section-kicker">ТАНЫ ГАРАЖИД НЭМЭХ</span>
      <h2>БҮХ ЦУГЛУУЛГА <small>{items.length} зүйл</small></h2></div>
      <button type="button" onClick={onRace}>▶ УРАЛДАЖ ЗООС ОЛОХ →</button></div>
    <nav className="collection-tabs" aria-label="Барааны төрөл">
      {tabs.map(t => <button key={t.id} className={tab === t.id ? 'current' : ''} aria-pressed={tab === t.id}
        onClick={() => {setTab(t.id);setRarity('all');}}>{t.label}</button>)}
    </nav>
    {(tab === 'all' || tab === 'car') && <nav className="shop-rarity-tabs" aria-label="Машины ховорын зэрэглэл">
      <button type="button" aria-pressed={rarity === 'all'} className={rarity === 'all' ? 'current' : ''} onClick={() => setRarity('all')}>Бүгд</button>
      {RARITIES.map(r => <button type="button" key={r.id} className={'rarity-filter rarity-'+r.code+(rarity===r.id?' current':'')}
        aria-pressed={rarity===r.id} onClick={() => setRarity(r.id)}>
        <span className="rarity-gem" aria-hidden="true"/> {r.id} <small>3 машин · ТҮВШИН {r.level}+</small>
      </button>)}
    </nav>}
    <div className="item-grid shop-item-grid">
      {items.map(item => {
        const acquired = isOwned(profile,item.kind,item.id);
        const selected = acquired && equipped(profile,item);
        const minLevel = item.minLevel ?? 1;
        const locked = !acquired && !isLevelUnlocked(profile,item);
        return <article className={'item-card shop-collectible '+classFor(item)+(locked?' level-locked':'')} key={item.kind+item.id}
          data-rarity={item.rarity} data-item-id={item.id}>
          <div className="item-card-header"><span className="item-rarity"><span className="rarity-gem" aria-hidden="true"/> {item.rarity}</span>
            <span>{item.kind === 'car' ? 'МАШИН' : item.kind === 'trail' ? 'МӨР' : item.kind === 'sticker' ? 'ТЭМДЭГ' : 'ЦОЛ'}</span></div>
          <div className={'item-art '+(item.kind === 'car' ? 'shop-car-art' : 'item-symbol')}>
            {item.kind === 'car' ? <><span className="car-aura" aria-hidden="true"/><img src={item.preview} alt={item.name} loading="lazy"/></> :
              <span>{item.preview}</span>}
          </div>
          <h2>{item.name}</h2>
          <p>{item.description}</p>
          <div className="shop-item-meta">
            <span>{acquired ? '✓ ЦУГЛУУЛСАН' : locked ? '🔒 ТҮВШИН ' + minLevel + ' ХЭРЭГТЭЙ' : '✓ ТҮВШИН ' + minLevel + ' НЭЭЛТТЭЙ'}</span>
            {item.effect && <span>✧ ОНЦГОЙ ЭФФЕКТ</span>}
          </div>
          <div className="item-action">
            <strong>{acquired ? 'ТАНЫХ' : '◈ ' + item.price.toLocaleString('mn-MN')}</strong>
            <button disabled={selected || locked || (!acquired && profile.coins < item.price)}
              onClick={() => action(item)}>{actionText(item)}</button>
          </div>
        </article>;
      })}
    </div>
    <p className="reward-disclaimer">
      Бүх шинэ машин гоёлын зориулалттай: бичих хурд, байр, шагналыг нэмэхгүй. Түвшин XP-ээс хамаарна.
      Худалдан авсан машин энэ төхөөрөмжийн гаражид хадгалагдах бөгөөд одоогоор серверийн баталгаатай данс биш.
      <button onClick={onRace}>Зоос болон XP цуглуулах →</button>
    </p>
  </div>;
}
