import {useState} from 'react';
import {SHOP} from '@typeracer/shared';
import type {EarnedOnlineProfile} from '../onlineProgress';
import './OnlineSeasonPage.css';

type Props={
  online:EarnedOnlineProfile|null;
  busy:boolean; error:string;
  onClaim:(tier:number)=>void; onRace:()=>void; onShop:()=>void;
};
const number=(x:number)=>x.toLocaleString('mn-MN');
const date=(at:number)=>new Intl.DateTimeFormat('mn-MN',{
  timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'long',day:'numeric'
}).format(new Date(at));
const art=(key:string|null)=>{
  if (!key) return null;
  return SHOP.find(item=>item.kind+':'+item.id===key)??null;
};

/** Server-backed free seasons. Old Season 01 local rewards remain in the
 * browser profile; new seasons can only be claimed with verified race XP.
 */
export function OnlineSeasonPage({online,busy,error,onClaim,onRace,onShop}:Props) {
  const [chosen,setChosen]=useState(1);
  if(!online)return <section className="online-season-unavailable" data-testid="online-season">
    <span className="section-kicker">SEASON / ONLINE</span>
    <h1>ШИНЭ УЛИРАЛ</h1>
    <p role="status">{error||'Улирлын серверийн мэдээллийг ачаалж байна…'}</p>
    <button type="button" className="primary-button" onClick={onRace}>▶ УРАЛДАХ</button>
  </section>;
  const season=online.season;
  const current=season.rewards.find(x=>x.tier===chosen)??season.rewards[0];
  const unlocked=season.rewards.filter(x=>x.claimed||x.claimable).length;
  const achieved=season.rewards.filter(x=>x.claimed).length;
  const max=season.rewards.at(-1)?.xp??10500;
  const focus=art(current.itemKey);
  const remaining=Math.max(0,current.xp-season.xp);
  return <div className="online-season" data-testid="online-season">
    <header className="online-season-head">
      <div>
        <span className="section-kicker">SEASON {String(season.number).padStart(2,'0')} / СЕРВЕРТ ХАДГАЛСАН</span>
        <h1>{season.name}. <em>BATTLE PASS</em></h1>
        <p>{date(season.from)} – {date(season.until-1)} · Бүх шагнал үнэгүй ·
          Монголын цагаар автоматаар солигдоно.</p>
      </div>
      <button type="button" className="primary-button" onClick={onRace}>▶ УРАЛДАХ</button>
    </header>
    <section className="online-season-metrics" aria-label="Улирлын ахиц">
      <div><span>ОНЛАЙН XP</span><strong>{number(season.xp)} <small>/ {number(max)}</small></strong></div>
      <div><span>НЭЭГДСЭН ШАТ</span><strong>{unlocked} <small>/ 8</small></strong></div>
      <div><span>ШАГНАЛ АВСАН</span><strong>{achieved} <small>/ 8</small></strong></div>
      <div><span>ҮЛДСЭН ХУГАЦАА</span><strong>{season.remainingDays} <small>хоног</small></strong></div>
    </section>
    <div className="online-season-meter" role="progressbar" aria-label="Улирлын ахиц"
      aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(season.xp,max)}>
      <span style={{width:Math.min(100,season.xp/max*100)+'%'}}/>
    </div>
    <section className="online-season-feature" aria-label="Сонгосон шагнал">
      <div className="online-season-feature-art">
        {focus?.kind==='car' && typeof focus.preview==='string' && focus.preview.startsWith('/')
          ? <img src={focus.preview} alt={focus.name} loading="lazy"/>
          : <span aria-hidden="true">{focus?.preview||'◈'}</span>}
      </div>
      <div className="online-season-feature-info">
        <span className="section-kicker">ШАТ {String(current.tier).padStart(2,'0')} / 08</span>
        <h2>{current.name}</h2>
        <p>{number(current.xp)} XP шаардлагатай · {number(season.xp)} XP цуглуулсан</p>
        {current.claimed ? <strong className="online-season-claimed">✓ ШАГНАЛ АВСАН</strong> :
          <button type="button" className="primary-button" disabled={!current.claimable||busy}
            onClick={()=>onClaim(current.tier)} data-testid="online-season-claim">
            {busy?'БАТАЛГААЖУУЛЖ БАЙНА…':current.claimable?'✓ ШАГНАЛ АВАХ':
              number(remaining)+' XP ҮЛДСЭН'}
          </button>}
        {error&&<p role="alert" className="error-note">{error}</p>}
        <p className="online-season-help">Зөвхөн серверт бүртгэгдсэн дууссан Quick Race-аас XP тооцно.
          Давхар item эзэмшдэг бол сервер автоматаар үнэгүй зоосоор нөхөн олгоно.</p>
      </div>
    </section>
    <section className="online-season-rewards" aria-label="Улирлын найман шагнал">
      <h2>ШАГНАЛЫН ЗАМ</h2>
      <div className="online-season-grid">
        {season.rewards.map(reward=><button type="button" data-tier={reward.tier} key={reward.tier}
          className={'online-season-tier'+(chosen===reward.tier?' selected':'')+
            (reward.claimed?' claimed':reward.claimable?' ready':' locked')}
          aria-pressed={chosen===reward.tier}
          onClick={()=>setChosen(reward.tier)}>
          <span>ШАТ {String(reward.tier).padStart(2,'0')}</span>
          <strong>{reward.name}</strong>
          <small>{number(reward.xp)} XP</small>
          <em>{reward.claimed?'✓ АВСАН':reward.claimable?'● БЭЛЭН':'🔒 НЭЭГДЭЭГҮЙ'}</em>
        </button>)}
      </div>
    </section>
    <footer className="online-season-footer">
      <span>Season 01-ийн өмнө авсан локал шагналууд устахгүй. Шинэ улирлын шагнал серверт хадгалагдана.</span>
      <button type="button" onClick={onShop}>ДЭЛГҮҮР ҮЗЭХ</button>
    </footer>
  </div>;
}
