import { SEASON, SEASON_REWARDS, getItem, type Profile } from '../progression';
type Props = { profile: Profile; onClaim: (tier: number) => void; onRace: () => void };
export function SeasonPage({ profile, onClaim, onRace }: Props) {
  const remaining = Math.max(0, Math.ceil((SEASON.until - Date.now()) / 86_400_000));
  const active = Date.now() >= SEASON.from && Date.now() < SEASON.until;
  const next = SEASON_REWARDS.find(r => profile.seasonXp < r.xp);
  const goal = next?.xp || SEASON_REWARDS[SEASON_REWARDS.length-1].xp;
  return <div className="collection-page season-page">
    <div className="season-hero">
      <div className="season-hero-copy">
        <span className="section-kicker">2026 ОНЫ НАМРЫН УЛИРАЛ · ҮНЭГҮЙ ЗАМНАЛ</span>
        <h1>ЭХНИЙ <span>ГАРАА.</span></h1>
        <p>Уралдаан бүрт улирлын туршлага нэмэгдэнэ. Шат болгонд шинэ машин, мөр, цол эсвэл зоосоо өөрөө аваарай.</p>
        <div className="season-stats"><div><b>{profile.seasonXp.toLocaleString('mn-MN')}</b><small>УЛИРЛЫН XP</small></div>
          <div><b>{profile.claimed.length} / {SEASON_REWARDS.length}</b><small>АВСАН ШАГНАЛ</small></div>
          <div><b>{remaining}</b><small>ҮЛДСЭН ХОНОГ</small></div></div>
        <div className="season-meter"><span style={{width: Math.min(100,profile.seasonXp / goal * 100) + '%'}}/></div>
        <small>{next ? 'Дараагийн шагнал: ' + next.xp + ' XP' : 'Бүх шатны шаардлагыг биелүүлсэн'} · Зөвхөн Монгол хэлний уралдаан</small>
        <button className="primary-button" onClick={onRace}>▶ УРАЛДАЖ XP ЦУГЛУУЛАХ →</button>
      </div>
      <img src="/cars/khan.svg" alt="Улирлын шагнал Хааны хүлэг"/>
    </div>
    <div className="season-track-head"><h2>ШАГНАЛЫН ЗАМ</h2><span>8 ҮЕ ШАТ · ТӨЛБӨРГҮЙ</span></div>
    <div className="season-rewards">
      {SEASON_REWARDS.map(r => {
        const claimed = profile.claimed.includes(r.tier);
        const unlocked = profile.seasonXp >= r.xp;
        const item = r.kind && r.itemId ? getItem(r.kind,r.itemId) : null;
        return <article className={'season-tier '+(claimed?'received':unlocked?'available':'locked')} key={r.tier}>
          <div className="season-tier-head"><b>{String(r.tier).padStart(2,'0')}</b><span>{r.xp} XP</span></div>
          <div className="season-tier-art">{item?.kind === 'car' ? <img src={item.preview} alt={item.name}/> : <span>{item?.preview || '◈'}</span>}</div>
          <h3>{item?.name || r.coins + ' зоос'}</h3>
          <span className="season-free">ҮНЭГҮЙ</span>
          <button onClick={() => onClaim(r.tier)} disabled={!active || claimed || !unlocked}>
            {claimed ? '✓ Авсан' : !active ? 'Улирал дууссан' : unlocked ? 'Шагнал авах' : '🔒 ' + r.xp + ' XP'}
          </button>
        </article>;
      })}
    </div>
    <p className="help-note">Улирал: 2026.10.01–2026.11.30 (Улаанбаатарын цагаар). Шагналууд санамсаргүй биш.
      Одоогоор ахиц төхөөрөмжийн хөтөчид хадгалагдана; хэрэглэгчийн бүртгэл, төлбөрт зам нээгээгүй.</p>
  </div>;
}
