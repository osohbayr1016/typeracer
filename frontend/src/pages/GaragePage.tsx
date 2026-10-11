import './GaragePage.css';
import { useState } from 'react';
import { CARS, carKeys, type Skin } from './cars';
import { ITEMS, TRAIL_NAMES, TITLE_NAMES, STICKER_SYMBOLS, isOwned,
  playerLevel, type CosmeticKind, type Profile, type Trail, type Title, type Sticker } from '../progression';
type Props = { profile: Profile; onEquip: (kind: CosmeticKind, id: string) => void;
  onPlay: () => void; onShop: () => void; onSeason: () => void };
type Tab = 'car' | 'trail' | 'title' | 'sticker';
const tabs: {key: Tab; label: string}[] = [
  {key:'car',label:'Машин'}, {key:'trail',label:'Гэрлийн мөр'},
  {key:'title',label:'Цол'}, {key:'sticker',label:'Тэмдэг'}
];
export function GaragePage({ profile, onEquip, onPlay, onShop, onSeason }: Props) {
  const [tab, setTab] = useState<Tab>('car');
  const equipped = tab === 'car' ? profile.car : tab === 'trail' ? profile.trail : tab === 'title' ? profile.title : profile.sticker;
  const level = playerLevel(profile.xp);
  const options = tab === 'car' ? carKeys.map(key => ({
    id: key, label: CARS[key].label, icon: CARS[key].icon, note: 'Машин'
  })) : tab === 'trail' ? (Object.keys(TRAIL_NAMES) as Trail[]).map(key => ({
    id: key, label: TRAIL_NAMES[key], icon: '', note: 'Гэрлийн мөр'
  })) : tab === 'title' ? (Object.keys(TITLE_NAMES) as Title[]).map(key => ({
    id: key, label: TITLE_NAMES[key], icon: '', note: 'Нэрийн цол'
  })) : (Object.keys(STICKER_SYMBOLS) as Sticker[]).map(key => ({
    id: key, label: key === 'none' ? 'Тэмдэггүй' : ITEMS.find(i => i.kind === 'sticker' && i.id === key)?.name || key, icon: '', note: 'Тэмдэг'
  }));
  return <div className="garage-page">
    <div className="flow-heading garage-flow-heading">
      <span className="section-kicker">МИНИЙ ГАРАЖ · ЦУГЛУУЛГА</span>
      <h1>МИНИЙ <span>ГАРАЖ.</span></h1>
      <p>Машин, мөр, цол, тэмдэгээ сонгож өөрийн хэв маягаа бүрдүүлээрэй. Гоёл бичих хурдыг нэмэхгүй.</p>
    </div>
    <section className="garage-feature garage-custom-feature">
      <div>
        <span className="section-kicker">ОДОО СОНГОСОН</span>
        <h2>{CARS[profile.car].label}</h2>
        <p>ТҮВШИН {level} <span>·</span> {profile.xp} XP <span>·</span> {TITLE_NAMES[profile.title]}</p>
        <div className="equipped-tags">
          <span>{TRAIL_NAMES[profile.trail]}</span>
          {CARS[profile.car].rarity && <span className="garage-rarity-label">{CARS[profile.car].rarity}</span>}
          <span>{profile.sticker === 'none' ? 'Тэмдэггүй' : STICKER_SYMBOLS[profile.sticker] + ' Тэмдэг'}</span>
        </div>
        <button className="primary-button" onClick={onPlay}>▶ ЭНЭ МАШИНААР УРАЛДАХ →</button>
      </div>
      <div className={'garage-preview-car trail-' + profile.trail + ' garage-effect-' + (CARS[profile.car].effect || 'none') + ' garage-rarity-' + (CARS[profile.car].rarity || 'starter')}>
        <span className="garage-preview-trail" aria-hidden="true"/>
        <span className="garage-collectible-aura" aria-hidden="true"/>
        <img src={CARS[profile.car].icon} alt={CARS[profile.car].label}/>
        {profile.sticker !== 'none' && <b className="garage-preview-sticker">{STICKER_SYMBOLS[profile.sticker]}</b>}
      </div>
    </section>
    <nav className="collection-tabs garage-tabs" aria-label="Гоёлын төрөл">
      {tabs.map(t => <button className={tab === t.key ? 'current' : ''} aria-pressed={tab === t.key}
        onClick={() => setTab(t.key)} key={t.key}>{t.label}</button>)}
    </nav>
    <div className="garage-collection-heading">
      <h2>{tabs.find(t => t.key === tab)?.label.toUpperCase()}</h2>
      <span>{options.filter(x => isOwned(profile,tab,x.id)).length} / {options.length} НЭЭГДСЭН</span>
    </div>
    <div className="garage-page-grid expanded-garage">
      {options.map((x,index) => {
        const owned = isOwned(profile,tab,x.id);
        const selected = equipped === x.id;
        const oldLevel = tab === 'car' && ['lime','phantom'].includes(x.id) ? CARS[x.id as Skin].unlockAt : 0;
        const minLevel = tab === 'car' ? ITEMS.find(i => i.kind === 'car' && i.id === x.id)?.minLevel : undefined;
        const rarity = tab === 'car' ? CARS[x.id as Skin].rarity : undefined;
        return <button key={x.id} className={'garage-car-tile'+(selected?' selected':'')+(!owned?' locked':'')}
          aria-pressed={selected} disabled={!owned} onClick={() => onEquip(tab,x.id)}>
          <span className="garage-tile-number">{String(index+1).padStart(2,'0')}</span>
          {rarity && <span className="garage-tile-rarity">{rarity}</span>}
          <div className={'garage-tile-preview trail-'+(tab === 'trail' ? x.id : 'none')}>
            {tab === 'car' ? <img src={x.icon} alt="" loading="lazy"/> :
              <span>{tab === 'trail' ? '〰' : tab === 'title' ? x.label : (STICKER_SYMBOLS[x.id as Sticker] || '○')}</span>}
          </div>
          <span className="garage-tile-footer"><b>{x.label}</b><small>{selected ? '✓ Сонгосон' : owned ? 'Сонгох' :
            minLevel ? '🔒 ТҮВШИН '+minLevel : oldLevel ? oldLevel+' XP' : '🔒 Дэлгүүрээс авах'}</small></span>
        </button>;
      })}
    </div>
    <div className="garage-path-actions">
      <button className="secondary-button" onClick={onShop}>◈ ДЭЛГҮҮРЭЭС АВАХ →</button>
      <button className="secondary-button" onClick={onSeason}>★ УЛИРЛЫН ШАГНАЛ →</button>
    </div>
    <p className="help-note">Авсан зүйлс хөтөчид хадгалагдана. Хэрэглэгчийн бүртгэлтэй серверийн бараа материал хараахан байхгүй.</p>
  </div>;
}
