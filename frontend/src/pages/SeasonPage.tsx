import './SeasonPage.css';
import {
  SEASON, SEASON_REWARDS, SHOP, getItem, seasonProgress,
  type SeasonReward, type Profile
} from '../progression';

type Props = {
  profile: Profile;
  onClaim: (tier: number) => void;
  onClaimAll: () => void;
  onRace: () => void;
  onShop: () => void;
};

function RewardArt({ reward, variant = 'card' }: {
  reward: SeasonReward; variant?: 'card' | 'featured';
}) {
  const item = reward.kind && reward.itemId ? getItem(reward.kind, reward.itemId) : null;
  const coins = reward.coins;
  return <div className={'pass-reward-art pass-reward-art-' + variant + (item?.kind === 'car' ? ' has-car' : '')}>
    {item?.kind === 'car' ? <img src={item.preview} alt={item.name} loading={variant === 'featured' ? 'eager' : 'lazy'} /> :
      <span className="pass-reward-symbol" aria-hidden="true">{coins ? '◈' : item?.preview || '✦'}</span>}
  </div>;
}

function rewardName(reward: SeasonReward) {
  const item = reward.kind && reward.itemId ? getItem(reward.kind, reward.itemId) : null;
  return item?.name ?? (reward.coins?.toLocaleString('mn-MN') + ' зоос');
}

function rewardKind(reward: SeasonReward) {
  return reward.coins ? 'ТОГЛООМЫН ЗООС' :
    reward.kind === 'car' ? 'ШИНЭ МАШИН' :
    reward.kind === 'trail' ? 'ГЭРЛИЙН МӨР' :
    reward.kind === 'sticker' ? 'ТЭМДЭГ' : 'ЦОЛ';
}

export function SeasonPage({ profile, onClaim, onClaimAll, onRace, onShop }: Props) {
  const progress = seasonProgress(profile);
  const focused = progress.focused;
  const focusedClaimable = progress.claimable.some(r => r.tier === focused.tier);
  const allRewards = SEASON_REWARDS.length;
  const claimed = SEASON_REWARDS.filter(r => profile.claimed.includes(r.tier)).length;
  const seasonEnds = new Intl.DateTimeFormat('mn-MN', { timeZone: 'Asia/Ulaanbaatar', month: 'long', day: 'numeric' })
    .format(new Date(SEASON.until - 1));
  const collectionCars = SHOP.filter(item => item.kind === 'car' && item.minLevel !== undefined);
  const showcased = ['nebula', 'royal', 'dragon'].map(id => collectionCars.find(item => item.id === id)).filter(
    (item): item is (typeof collectionCars)[number] => Boolean(item));

  return <main className="season-pass collection-page" data-testid="season-pass">
    <header className="pass-heading">
      <div>
        <span className="pass-eyebrow">УЛИРАЛ 01 <span aria-hidden="true">/</span> БҮГДЭД НЭЭЛТТЭЙ</span>
        <h1>ЭХНИЙ <span>ГАРАА</span></h1>
        <p>Уралдаан хийж улирлын XP цуглуулаарай. Шат бүрийн шагналыг түвшинд хүрээд үнэгүй авна.</p>
      </div>
      <div className="pass-season-badge">
        <span className="pass-season-live">{progress.active ? '● УЛИРАЛ ИДЭВХТЭЙ' : '○ УЛИРАЛ ДУУССАН'}</span>
        <strong>{progress.remainingDays}<small> хоног</small></strong>
        <span>{seasonEnds} хүртэл</span>
      </div>
    </header>

    <div className="pass-overview">
      <section className="pass-progress-card" aria-labelledby="pass-progress-heading">
        <div className="pass-card-top">
          <span className="pass-eyebrow">МИНИЙ АХИЦ</span>
          <span className="pass-free-stamp">ҮНЭГҮЙ BATTLE PASS</span>
        </div>
        <h2 id="pass-progress-heading">{progress.completed ? 'БҮХ ШАГНАЛЫГ АВСАН!' :
          progress.claimable.length ? progress.claimable.length + ' ШАГНАЛ АВАХАД БЭЛЭН' :
          progress.next ? 'ДАРААГИЙН ШАГНАЛ РУУ' : 'БҮХ ШАТ НЭЭГДСЭН'}</h2>
        <div className="pass-progress-numbers">
          <strong>{profile.seasonXp.toLocaleString('mn-MN')} <small>XP</small></strong>
          <span>{progress.next ? progress.targetXp.toLocaleString('mn-MN') + ' XP хүртэл' : 'Бүх 8 шат нээгдсэн'}</span>
        </div>
        <div className="pass-progress-track" role="progressbar" aria-label="Улирлын нийт ахиц"
          aria-valuemin={0} aria-valuemax={SEASON_REWARDS[allRewards-1].xp}
          aria-valuenow={Math.min(profile.seasonXp, SEASON_REWARDS[allRewards-1].xp)}>
          <span style={{ width: progress.totalPercent + '%' }}/>
        </div>
        <div className="pass-progress-caption">
          <span>{progress.next ? progress.xpToNext.toLocaleString('mn-MN') + ' XP үлдсэн' : 'Сүүлийн шат нээгдсэн'}</span>
          <span>{progress.unlocked.length} / {allRewards} шат нээгдсэн</span>
        </div>
        <div className="pass-stats">
          <div><strong>{claimed}/{allRewards}</strong><span>АВСАН ШАГНАЛ</span></div>
          <div><strong>{progress.claimable.length}</strong><span>АВАХ БОЛОМЖТОЙ</span></div>
          <div><strong>{profile.races}</strong><span>НИЙТ УРАЛДААН</span></div>
        </div>
        <div className="pass-main-actions">
          {progress.claimable.length > 0 && <button type="button" className="pass-claim-all"
            onClick={onClaimAll} data-testid="season-claim-all">
            <span aria-hidden="true">✓</span> {progress.claimable.length} ШАГНАЛЫГ БҮГДИЙГ АВАХ
          </button>}
          <button className="pass-race-cta" type="button" onClick={onRace}>▶ УРАЛДАЖ XP ОЛОХ <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section className={'pass-next-card' + (focusedClaimable ? ' can-claim' : '')}
        aria-labelledby="pass-next-heading" data-testid="season-spotlight">
        <div className="pass-next-top">
          <span className="pass-eyebrow">{focusedClaimable ? 'ОДОО АВЧ БОЛНО' : progress.next ? 'ДАРААГИЙН ШАГНАЛ' : 'СҮҮЛЧИЙН ШАГНАЛ'}</span>
          <span className="pass-next-tier">ҮЕ {String(focused.tier).padStart(2, '0')}</span>
        </div>
        <RewardArt reward={focused} variant="featured"/>
        <div className="pass-next-bottom">
          <span>{rewardKind(focused)}</span>
          <h2 id="pass-next-heading">{rewardName(focused)}</h2>
          <p>{focusedClaimable ? 'Нээгдсэн шагналаа одоо гараждаа нэмээрэй.' :
            progress.completed ? 'Энэ улирлын бүх бэлгийг цуглуулсан байна.' :
            progress.active ? focused.xp.toLocaleString('mn-MN') + ' улирлын XP хүрэхэд нээгдэнэ.' :
            'Улирлын шагнал авах хугацаа дууссан.'}</p>
          {focusedClaimable && <button type="button" onClick={() => onClaim(focused.tier)}>ШАГНАЛ АВАХ →</button>}
        </div>
      </section>
    </div>

    <section className="pass-roadmap" aria-labelledby="pass-rewards-title">
      <div className="pass-section-heading">
        <div><span className="pass-eyebrow">ТАНЫ ШАГНАЛЫН ЗАМ</span>
          <h2 id="pass-rewards-title">8 ШАТ · 8 ШАГНАЛ</h2>
          <p>Өмнөх шатыг алгасаж болно. XP хүрсэн бүх шагналаа тус тусад нь эсвэл нэг дор аваарай.</p></div>
        {progress.claimable.length > 0 && <span className="pass-ready-indicator">{progress.claimable.length} шагнал бэлэн</span>}
      </div>
      <ol className="pass-tier-list">
        {SEASON_REWARDS.map(reward => {
          const received = profile.claimed.includes(reward.tier);
          const earned = profile.seasonXp >= reward.xp;
          const canClaim = progress.active && earned && !received;
          const state = received ? 'received' : canClaim ? 'available' : 'locked';
          return <li key={reward.tier} className={'pass-tier-wrap ' + state}>
            <article className={'season-tier pass-tier ' + state} data-tier={reward.tier}>
              <div className="pass-tier-top">
                <span className="pass-tier-number">{String(reward.tier).padStart(2, '0')}</span>
                <span className={'pass-tier-status ' + state}>
                  {received ? '✓ АВСАН' : canClaim ? '● АВАХАД БЭЛЭН' : earned ? 'НЭЭГДСЭН' : '🔒 ХҮЛЭЭГДЭЖ БАЙНА'}
                </span>
              </div>
              <RewardArt reward={reward}/>
              <div className="pass-tier-details">
                <span className="pass-reward-kind">{rewardKind(reward)}</span>
                <h3>{rewardName(reward)}</h3>
                <span className="pass-tier-xp">{reward.xp.toLocaleString('mn-MN')} XP</span>
              </div>
              <button type="button" onClick={() => onClaim(reward.tier)}
                disabled={!canClaim}>
                {received ? '✓ Авсан' : !progress.active ? 'Улирал дууссан' : canClaim ? 'Шагнал авах' : '🔒 ' + reward.xp + ' XP'}
              </button>
            </article>
          </li>;
        })}
      </ol>
    </section>

    <section className="pass-bottom" aria-label="XP авах заавар болон дэлгүүрийн цуглуулга">
      <div className="pass-how">
        <span className="pass-eyebrow">ХЭРХЭН АХИХ ВЭ?</span>
        <h2>УРАЛД · XP ОЛ · ШАГНАЛАА АВ</h2>
        <p>1. Уралдаанд орно <span>→</span> 2. Дуусгаад XP авна <span>→</span> 3. Нээгдсэн шагналаа авна.</p>
        <button type="button" onClick={onRace}>УРАЛДААНД ОРОХ →</button>
      </div>
      <div className="pass-shop-discovery">
        <div className="pass-shop-art" aria-hidden="true">
          {showcased.map(item => <img key={item.id} src={item.preview} alt="" loading="lazy"/>)}
        </div>
        <div><span className="pass-eyebrow">ДЭЛГҮҮРИЙН ЦУГЛУУЛГА</span>
          <h2>{collectionCars.length} ШИНЭ МАШИН</h2>
          <p>6 зэрэглэл · XP түвшнээр нээгдэнэ · зоосоор авна</p>
          <button type="button" onClick={onShop}>ДЭЛГҮҮР ҮЗЭХ ↗</button></div>
      </div>
    </section>

    <p className="pass-disclaimer">Улирлын хугацаа: 2026.10.01–2026.11.30, Улаанбаатарын цагаар. Бүх шагнал үнэгүй, санамсаргүй хайрцаг эсвэл төлбөрт зам байхгүй.
      Ахиц болон шагнал одоогоор зөвхөн энэ төхөөрөмжийн хөтөчид хадгалагдана.</p>
  </main>;
}
