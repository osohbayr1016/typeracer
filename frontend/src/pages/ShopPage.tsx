import './ShopPage.css';
import { useEffect, useRef, useState } from 'react';
import { CARS, RARITIES, type Rarity, type Skin } from './cars';
import { SHOP, NEW_CAR_COLLECTION, isOwned, isLevelUnlocked, playerLevel, shopRotation,
  type CosmeticKind, type Profile, type Cosmetic } from '../progression';

type Props = { profile: Profile; onBuy: (item: Cosmetic) => void; onEquip: (item: Cosmetic) => void; onRace: () => void; paidCoins?: number; paidBusy?: boolean; paidError?: string; onPaidBuy?: (item: Cosmetic) => void; onTopUp?: () => void; onlineWallet?:boolean; freeBusy?:boolean; freeError?:string };
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
export function ShopPage({ profile, onBuy, onEquip, onRace, paidCoins = 0, paidBusy = false, paidError, onPaidBuy, onTopUp, onlineWallet=false, freeBusy=false, freeError }: Props) {
  const [tab, setTab] = useState<'all' | CosmeticKind>('all');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [preview, setPreview] = useState<Cosmetic | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!preview) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const dialog = dialogRef.current;
    const close = dialog?.querySelector<HTMLButtonElement>('.shop-preview-close');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close?.focus({preventScroll:true});
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setPreview(null); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )).filter(element => element.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length-1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({preventScroll:true});
    };
  }, [preview]);
  const level = playerLevel(profile.xp);
  const rotation = shopRotation();
  const carsOwned = NEW_CAR_COLLECTION.filter(item => isOwned(profile, 'car', item.id)).length;
  const totalCars = NEW_CAR_COLLECTION.length;
  const items = SHOP.filter(item => (tab === 'all' || item.kind === tab) &&
    (rarity === 'all' || item.kind === 'car' && item.rarity === rarity && NEW_CAR_COLLECTION.some(car => car.id === item.id)));

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
  function openCollection(item: Cosmetic) {
    setTab('car');
    setRarity(item.rarity);
    document.getElementById('shop-catalog')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  return <div className="collection-page rarity-shop">
    <header className="collection-heading">
      <div><span className="section-kicker">МОНГОЛ УРАЛДААН · 6 ЗЭРЭГЛЭЛ</span>
        <h1>ХҮЛГИЙН <span>ЦУГЛУУЛГА.</span></h1>
        <p>6 зэрэглэл · {totalCars} анхны машин · хүлэг бүр өөрийн гэрлийн эффекттэй. Уралдаж XP, зоос цуглуулаад нээгээрэй.</p>
      </div>
      <div className="shop-wallet">
        <div className="coin-counter"><span>{onlineWallet?'СЕРВЕРИЙН УРАЛДААНЫ ЗООС':'ЭНЭ ХӨТЧИЙН ДАСГАЛЫН ЗООС'}</span><strong>◈ {profile.coins.toLocaleString('mn-MN')}</strong></div>
        <div className="paid-shop-balance">Цэнэглэсэн: ◈ {paidCoins} <button type="button" onClick={onTopUp}>+ Цэнэглэх</button></div>
        <small className="social-footnote">{onlineWallet?'Онлайн уралдааны шагнал серверт бүртгэгдэнэ. Хөтчийн хуучин зоос шилжихгүй.':'Сервертэй холбогдоогүй үед зөвхөн энэ хөтчийн дасгалын зоос ашиглана.'}</small>
        <div className="shop-collection-progress">
          <span>ТҮВШИН {level} · ЦУГЛУУЛГА {carsOwned}/{totalCars}</span>
          <div className="shop-meter" role="progressbar" aria-valuemin={0} aria-valuemax={totalCars} aria-valuenow={carsOwned} aria-label="Шинэ машин цуглуулсан тоо">
            <span style={{ width: carsOwned / totalCars * 100 + '%' }}/></div>
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
          <button type="button" onClick={() => setPreview(rotation.featured[0])}>МАШИНЫГ ТОМООР ҮЗЭХ ↗</button>
        </div>
        <div className="shop-car-art shop-featured-car"><span className="car-aura" aria-hidden="true"/>
          <img src={rotation.featured[0].preview} alt={rotation.featured[0].name}/></div>
      </section>
      <section className="shop-daily" aria-labelledby="daily-items">
        <div className="shop-daily-head"><h2 id="daily-items">ӨНӨӨДРИЙН СОНГОЛТ</h2><span>Өдөр бүр шинэчлэгдэнэ</span></div>
        <div className="shop-daily-list">
          {rotation.daily.map(item => <button key={item.id} type="button" className={'shop-daily-item '+classFor(item)}
            onClick={() => setPreview(item)}>
            <span className="shop-car-art"><span className="car-aura" aria-hidden="true"/><img src={item.preview} alt=""/></span>
            <span className="shop-daily-name"><strong>{item.name}</strong><small>{item.rarity} · ТҮВШИН {item.minLevel}</small></span>
            <span aria-hidden="true">↗</span>
          </button>)}
        </div>
      </section>
    </div>
    <p className="shop-spotlight-note">Онцлох бараа солигдсон ч машинууд бүрэн каталогт байнга үлдэнэ. Санамсаргүй хайрцаг байхгүй. Цэнэглэсэн зоосоор авах товч тусдаа байна.</p>

    <div id="shop-catalog" className="shop-catalog-head"><div><span className="section-kicker">ТАНЫ ГАРАЖИД НЭМЭХ</span>
      <h2>БҮХ ЦУГЛУУЛГА <small>{items.length} зүйл</small></h2></div>
      <button type="button" onClick={onRace}>▶ УРАЛДАЖ ЗООС ОЛОХ →</button></div>
    <nav className="collection-tabs" aria-label="Барааны төрөл">
      {tabs.map(t => <button key={t.id} className={tab === t.id ? 'current' : ''} aria-pressed={tab === t.id}
        onClick={() => {setTab(t.id);setRarity('all');}}>{t.label}</button>)}
    </nav>
    {(tab === 'all' || tab === 'car') && <nav className="shop-rarity-tabs" aria-label="Машины ховорын зэрэглэл">
      <button type="button" aria-pressed={rarity === 'all'} className={rarity === 'all' ? 'current' : ''} onClick={() => setRarity('all')}>Бүгд</button>
      {RARITIES.map(r => {
        const tierCars = NEW_CAR_COLLECTION.filter(item => item.rarity === r.id);
        const low = Math.min(...tierCars.map(item => item.price));
        const high = Math.max(...tierCars.map(item => item.price));
        return <button type="button" key={r.id} className={'rarity-filter rarity-'+r.code+(rarity===r.id?' current':'')}
          aria-pressed={rarity===r.id} onClick={() => setRarity(r.id)}>
          <span className="rarity-gem" aria-hidden="true"/> {r.id}
          <small>{tierCars.length} машин · LV {r.level}+ · ◈ {low}–{high}</small>
        </button>;
      })}
    </nav>}
    {(tab === 'all' || tab === 'car') && <div className="shop-tier-explanation" data-testid="shop-tier-explanation">
      <span><strong>МИНИЙ ТҮВШИН: {level}</strong> · Машины зэрэглэл өндөр байх тусам үнэ болон нээх түвшин өснө.</span>
      <span><strong>◈ {profile.coins.toLocaleString('mn-MN')} ЗООС</strong> · Түвшин хүрсэн машиныг худалдаж аваад гараждаа сонгоорой.</span>
    </div>}
    {paidError && <p role="alert" className="error-note">{paidError}</p>}
    {freeError && <p role="alert" className="error-note">{freeError}</p>}
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
            {item.kind === 'car' ? <>
              <span className="car-aura" aria-hidden="true"/>
              <img src={item.preview} alt={item.name} loading="lazy"/>
              <button type="button" className="shop-inspect-button" aria-label={item.name + ' машиныг томоор харах'}
                onClick={() => setPreview(item)}>ТОМООР ҮЗЭХ ↗</button>
            </> : <span>{item.preview}</span>}
          </div>
          <h2>{item.name}</h2>
          {item.kind === 'car' && CARS[item.id as Skin]?.modelType &&
            <span className="shop-vehicle-type">{CARS[item.id as Skin].modelType}</span>}
          <p>{item.description}</p>
          <div className="shop-item-meta">
            <span>{acquired ? '✓ ЦУГЛУУЛСАН' : locked ? '🔒 ТҮВШИН ' + minLevel + ' ХЭРЭГТЭЙ' : '✓ ТҮВШИН ' + minLevel + ' НЭЭЛТТЭЙ'}</span>
            {item.effect && <span>✧ ОНЦГОЙ ЭФФЕКТ</span>}
          </div>
          <div className="item-action">
            <strong>{acquired ? 'ТАНЫХ' : '◈ ' + item.price.toLocaleString('mn-MN')}</strong>
            <button disabled={selected || freeBusy || locked || (!acquired && profile.coins < item.price)}
              onClick={() => action(item)}>{actionText(item)}</button>
          </div>
          {!acquired && !locked && onPaidBuy && paidCoins >= item.price && <button type="button" className="paid-buy"
            disabled={paidBusy} onClick={() => onPaidBuy(item)}>ЦЭНЭГЛЭСЭН ◈ {item.price} ЗООСООР АВАХ</button>}
        </article>;
      })}
    </div>
    {preview && <div className="shop-preview-overlay" role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={preview.name + ' машины дэлгэрэнгүй'}
        className={'shop-preview-dialog '+classFor(preview)} data-testid="shop-car-preview">
        <div className="shop-preview-head">
          <span className="shop-eyebrow">МАШИНЫ ДЭЛГЭРЭНГҮЙ</span>
          <button type="button" className="shop-preview-close" aria-label="Хаах"
            onClick={() => setPreview(null)}>✕</button>
        </div>
        <div className="shop-preview-stage shop-car-art">
          <span className="car-aura" aria-hidden="true"/>
          <img src={preview.preview} alt={preview.name}/>
        </div>
        <div className="shop-preview-info">
          <div><span className="shop-preview-rarity"><span className="rarity-gem" aria-hidden="true"/> {preview.rarity}</span>
            <h2>{preview.name}</h2>
            <span className="shop-vehicle-type">{CARS[preview.id as Skin]?.modelType ?? 'Гоёлын машин'}</span>
            <p>{preview.description}</p>
            <p>Энэ машин уралдааны хурд, шагналыг өөрчлөхгүй. Зөвхөн таны гараж, уралдаанд харагдана.</p>
          </div>
          <div className="shop-preview-purchase">
            <span>НЭЭХ ТҮВШИН {preview.minLevel ?? 1} · ТАНЫ ТҮВШИН {level}</span>
            <strong>{isOwned(profile,preview.kind,preview.id) ? 'ТАНЫ МАШИН' : '◈ ' + preview.price.toLocaleString('mn-MN')}</strong>
            <button type="button" onClick={() => action(preview)}
              disabled={equipped(profile,preview) || (!isOwned(profile,preview.kind,preview.id) &&
                (!isLevelUnlocked(profile,preview) || profile.coins < preview.price))}>
              {actionText(preview)}
            </button>
            {!isOwned(profile,preview.kind,preview.id) && isLevelUnlocked(profile,preview) && onPaidBuy && paidCoins >= preview.price &&
              <button type="button" className="paid-buy" disabled={paidBusy} onClick={() => onPaidBuy(preview)}>
                ЦЭНЭГЛЭСЭН ◈ {preview.price} ЗООСООР АВАХ
              </button>}
            {!isOwned(profile,preview.kind,preview.id) && (!isLevelUnlocked(profile,preview) || profile.coins < preview.price) &&
              <button type="button" className="shop-preview-race" onClick={() => { setPreview(null); onRace(); }}>
                УРАЛДАЖ XP, ЗООС ОЛОХ →
              </button>}
          </div>
        </div>
      </section>
    </div>}
    <p className="reward-disclaimer">
      Бүх шинэ машин гоёлын зориулалттай: бичих хурд, байр, шагналыг нэмэхгүй. Түвшин XP-ээс хамаарна.
      Уралдаж олсон зоос энэ төхөөрөмжид хадгалагдана. Цэнэглэсэн зоос болон түүгээр авсан зүйлс таны бүртгэлд хадгалагдана.
      <button onClick={onRace}>Зоос болон XP цуглуулах →</button>
    </p>
  </div>;
}
