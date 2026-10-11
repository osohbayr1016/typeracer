import { useEffect, useRef, useState } from 'react';
import './SeasonPage.css';
import {
  SEASON, SEASON_REWARDS, getItem, seasonProgress,
  type SeasonReward, type Profile
} from '../progression';

type Props = {
  profile: Profile;
  onClaim: (tier: number) => void;
  onClaimAll: () => void;
  onRace: () => void;
  onShop: () => void;
};

const fmt = (n: number) => n.toLocaleString('mn-MN');
function nameOf(reward: SeasonReward): string {
  const item = reward.kind && reward.itemId ? getItem(reward.kind, reward.itemId) : null;
  return item?.name ?? fmt(reward.coins ?? 0) + ' зоос';
}
function labelOf(reward: SeasonReward): string {
  return reward.kind === 'car' ? 'МАШИН' : reward.kind === 'trail' ? 'ГЭРЛИЙН МӨР' :
    reward.kind === 'sticker' ? 'ТЭМДЭГ' : reward.kind === 'title' ? 'ЦОЛ' : 'ЗООС';
}
function RewardArt({reward,large=false}:{reward:SeasonReward;large?:boolean}) {
  const item=reward.kind&&reward.itemId?getItem(reward.kind,reward.itemId):null;
  return <div className={'battle-art' + (large?' battle-art-large':'') + (item?.kind==='car'?' battle-art-car':'')}>
    {item?.kind==='car' ? <img src={item.preview} alt={item.name} loading={large?'eager':'lazy'}/> :
      reward.coins ? <><span className="battle-coin" aria-hidden="true">◈</span><strong className="battle-coin-value">{fmt(reward.coins)}</strong></> :
      <span className="battle-symbol" aria-hidden="true">{item?.preview||'✦'}</span>}
  </div>;
}

export function SeasonPage({profile,onClaim,onClaimAll,onRace,onShop}:Props) {
  const progress=seasonProgress(profile);
  const [selected,setSelected]=useState<number>(()=>progress.focused.tier);
  const railRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const track=railRef.current;
    const tile=track?.querySelector<HTMLElement>('.season-tier[data-tier="'+selected+'"]');
    if(!track||!tile)return;
    const left=tile.offsetLeft+tile.offsetWidth/2-track.clientWidth/2;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({left,behavior:reduced?'instant':'smooth'});
  },[selected]);
  const reward=SEASON_REWARDS.find(x=>x.tier===selected)??progress.focused;
  const received=profile.claimed.includes(reward.tier);
  const unlocked=profile.seasonXp>=reward.xp;
  const canClaim=progress.active&&unlocked&&!received;
  const goal=SEASON_REWARDS[SEASON_REWARDS.length-1].xp;
  const next=progress.next;
  const complete=progress.completed;
  const progressText=next ? fmt(progress.xpToNext)+' XP үлдсэн' : 'Бүх шат нээгдсэн';
  const seasonEnds=new Intl.DateTimeFormat('mn-MN',{timeZone:'Asia/Ulaanbaatar',month:'long',day:'numeric'})
    .format(new Date(SEASON.until-1));
  const claimed=SEASON_REWARDS.filter(r=>profile.claimed.includes(r.tier)).length;

  return <main className="season-pass" data-testid="season-pass">
    <header className="battle-head">
      <div className="battle-heading-group">
        <span className="battle-overline">SEASON 01 <span aria-hidden="true">/</span> ЭХНИЙ ГАРАА</span>
        <h1>BATTLE <em>PASS</em></h1>
        <div className="battle-subline">
          <span className="battle-free"><span aria-hidden="true">✓</span> ҮНЭГҮЙ</span>
          <span>{progress.active ? fmt(progress.remainingDays)+' ХОНОГ ҮЛДСЭН' : 'УЛИРАЛ ДУУССАН'}</span>
          <span>{seasonEnds} хүртэл</span>
        </div>
      </div>
      <button type="button" className="battle-race-button" onClick={onRace}>
        ▶ УРАЛДАХ <span aria-hidden="true">→</span>
      </button>
    </header>

    <section className="battle-main" aria-label="Улирлын гол шагнал">
      <div className="battle-featured-art" data-testid="season-spotlight">
        <div className="battle-featured-deco" aria-hidden="true">01</div>
        <div className="battle-featured-top">
          <span>SEASON REWARDS</span><span>ҮЕ {String(reward.tier).padStart(2,'0')} / {SEASON_REWARDS.length}</span>
        </div>
        <RewardArt reward={reward} large/>
        <div className="battle-featured-bottom">
          <span className="battle-featured-type">{labelOf(reward)}</span>
          <strong>{nameOf(reward)}</strong>
        </div>
      </div>
      <div className="battle-featured-info">
        <span className="battle-overline">{received?'✓ АВСАН':canClaim?'● АВАХАД БЭЛЭН':'СОНГОСОН ШАГНАЛ'}</span>
        <h2>{nameOf(reward)}</h2>
        <div className="battle-goal"><span>НЭЭХ ШААРДЛАГА</span><strong>{fmt(reward.xp)} XP</strong></div>
        <div className="battle-goal"><span>ТАНЫ АХИЦ</span><strong>{fmt(profile.seasonXp)} XP</strong></div>
        <div className="battle-featured-actions">
          {canClaim ? <button type="button" className="battle-claim-primary" onClick={()=>onClaim(reward.tier)}>
            ✓ ШАГНАЛ АВАХ
          </button> : received ? <span className="battle-earned">✓ ЦУГЛУУЛСАН</span> :
            <span className="battle-locked">
              {progress.active ? fmt(Math.max(0,reward.xp-profile.seasonXp))+' XP ДУТУУ' : 'УЛИРАЛ ДУУССАН'}
            </span>}
        </div>
        <p className="battle-note">8 шат · Тоглож XP цуглуулна · Төлбөргүй</p>
      </div>
    </section>

    <section className="battle-progress-panel" aria-label="Battle Pass ахиц">
      <div className="battle-progress-top">
        <div><span className="battle-overline">МИНИЙ АХИЦ</span>
          <strong>{fmt(profile.seasonXp)} <small>/ {fmt(goal)} XP</small></strong></div>
        <div className="battle-progress-aside"><strong>{progress.unlocked.length}/{SEASON_REWARDS.length} ШАТ</strong>
          <span>{progressText}</span></div>
      </div>
      <div className="battle-progress-bar" role="progressbar" aria-label="Улирлын нийт ахиц"
        aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal,profile.seasonXp)}>
        <span style={{width:progress.totalPercent+'%'}}/>
      </div>
      <div className="battle-progress-bottom">
        <span>{claimed} ШАГНАЛ АВСАН</span>
        {progress.claimable.length>0 ? <button data-testid="season-claim-all" type="button" onClick={onClaimAll}>
          ✓ {progress.claimable.length} ШАГНАЛЫГ БҮГДИЙГ АВАХ
        </button> : <span>{complete?'БҮХ ШАГНАЛ АВСАН':'ДАРААГИЙН ШАТАА НЭЭ'}</span>}
      </div>
    </section>

    <section className="battle-roadmap" aria-labelledby="battle-roadmap-title">
      <div className="battle-roadmap-top">
        <div><span className="battle-overline">01 / ШАГНАЛЫН ЗАМ</span>
          <h2 id="battle-roadmap-title">ШАТУУД</h2></div>
        <div className="battle-rail-controls">
          <span className="battle-scroll-hint">8 ШАТ · ГҮЙЛГЭНЭ ҮҮ</span>
          <button type="button" aria-label="Өмнөх шагнал" disabled={selected<=1}
            onClick={()=>setSelected(Math.max(1,selected-1))}>‹</button>
          <button type="button" aria-label="Дараагийн шагнал" disabled={selected>=SEASON_REWARDS.length}
            onClick={()=>setSelected(Math.min(SEASON_REWARDS.length,selected+1))}>›</button>
        </div>
      </div>
      <div className="battle-rail-wrap" ref={railRef} tabIndex={0} aria-label="Battle Pass-ийн 8 шаттай шагналын зам. Хэвтээ гүйлгэнэ.">
        <ol className="battle-rail">
          {SEASON_REWARDS.map((tier,index)=>{
            const got=profile.claimed.includes(tier.tier);
            const earned=profile.seasonXp>=tier.xp;
            const available=progress.active&&earned&&!got;
            const state=got?'received':available?'available':'locked';
            return <li className={'battle-rail-step '+state} key={tier.tier}>
              <article className={'season-tier pass-tier '+state+(selected===tier.tier?' selected':'')}
                data-tier={tier.tier}>
                <button type="button" className="battle-select-tier" onClick={()=>setSelected(tier.tier)}
                  aria-pressed={selected===tier.tier} aria-label={'Үе '+tier.tier+': '+nameOf(tier)+', '+fmt(tier.xp)+' XP'}>
                  <div className="battle-tile-top">
                    <span className="battle-tier-number">{String(tier.tier).padStart(2,'0')}</span>
                    <span className="battle-tile-state">{got?'✓ АВСАН':available?'● БЭЛЭН':'🔒'}</span>
                  </div>
                  <RewardArt reward={tier}/>
                  <div className="battle-tier-label">
                    <span>{labelOf(tier)}</span>
                    <strong>{nameOf(tier)}</strong>
                  </div>
                  <span className="battle-tier-xp">{fmt(tier.xp)} XP</span>
                </button>
                <button type="button" className="battle-tier-action" onClick={()=>onClaim(tier.tier)}
                  disabled={!available}>
                  {got?'✓ Авсан':available?'Шагнал авах':fmt(tier.xp)+' XP'}
                </button>
              </article>
              <span className="battle-rail-node" aria-hidden="true">{got?'✓':index+1}</span>
            </li>;
          })}
        </ol>
      </div>
    </section>
    <div className="battle-bottom">
      <p>Шагналаа авахын тулд XP цуглуул. Өмнө авсан шагнал хэвээр үлдэнэ.</p>
      <button type="button" onClick={onShop}>ДЭЛГҮҮР ҮЗЭХ ↗</button>
    </div>
    <p className="battle-disclaimer">2026.10.01–2026.11.30 · Улаанбаатарын цаг · Бүх шагнал үнэгүй. Ахиц энэ төхөөрөмжид хадгалагдана.</p>
  </main>;
}
