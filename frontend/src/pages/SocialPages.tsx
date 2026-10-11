import { useState } from 'react';
import { CARS } from './cars';
import { type Profile, TITLE_NAMES, quickDayStreak, playerLevel } from '../progression';
import { type QuickRaceOutcome, raceStandings } from './quickResultsModel';
import './SocialPages.css';

type BaseProps = {
  profile: Profile; nickname: string; best: number;
  onPlay: () => void; onGarage: () => void;
};
const localNumber = (value: number) => value.toLocaleString('mn-MN');
const orderedHistory = (profile: Profile) => profile.history.filter(h => h.id.startsWith('quick:'));
const avg = (numbers: number[]) => numbers.length ? Math.round(numbers.reduce((sum,value) => sum + value,0) / numbers.length) : 0;

export function ProfilePage({ profile, nickname, best, onPlay, onGarage, onNameChange, onStats, onSeason }: BaseProps & {
  onNameChange: (value:string) => void; onStats: () => void; onSeason: () => void;
}) {
  const level = playerLevel(profile.xp);
  const recent = orderedHistory(profile);
  return <div className="social-page" data-testid="profile-page">
    <header className="social-heading"><span className="social-eyebrow">МИНИЙ ПРОФАЙЛ</span><h1>ПРОФАЙЛ</h1></header>
    <section className="social-profile-hero">
      <div className="social-avatar">TR</div>
      <div className="social-profile-name">
        <label htmlFor="profile-nickname">ТОГЛОГЧИЙН НЭР</label>
        <input id="profile-nickname" maxLength={20} value={nickname} onChange={e=>onNameChange(e.target.value)}
          aria-label="Тоглогчийн нэр" />
        <span>{TITLE_NAMES[profile.title]} · ТҮВШИН {level}</span>
      </div>
      <img src={CARS[profile.car].icon} alt={CARS[profile.car].label} className="social-profile-car"/>
    </section>
    <div className="social-stats-row">
      <div><span>ХУВИЙН РЕКОРД</span><strong>{best}<small> WPM</small></strong></div>
      <div><span>НИЙТ ГАРАА</span><strong>{localNumber(profile.races)}</strong></div>
      <div><span>ДАРААЛСАН ӨДӨР</span><strong>{quickDayStreak(profile)}<small> өдөр</small></strong></div>
      <div><span>ЗООС</span><strong>◈ {localNumber(profile.coins)}</strong></div>
    </div>
    <div className="social-two-grid">
      <section className="social-surface">
        <div className="social-card-heading"><h2>МИНИЙ МАШИН</h2><button type="button" onClick={onGarage}>ГАРАЖ ↗</button></div>
        <div className="social-owned-car"><img src={CARS[profile.car].icon} alt={CARS[profile.car].label}/><strong>{CARS[profile.car].label}</strong></div>
      </section>
      <section className="social-surface">
        <div className="social-card-heading"><h2>АХИЦ</h2><button type="button" onClick={onSeason}>BATTLE PASS ↗</button></div>
        <div className="social-progress-info"><span>ТҮВШИН {level}</span><strong>{profile.xp%300}/300 XP</strong></div>
        <div className="social-meter"><span style={{width:(profile.xp%300)/3+'%'}}/></div>
        <div className="social-progress-info"><span>СҮҮЛИЙН УРАЛДААН</span><strong>{recent[0]?.wpm ?? '—'} WPM</strong></div>
        <button type="button" className="social-inline-cta" onClick={onStats}>СТАТИСТИК ХАРАХ →</button>
      </section>
    </div>
    <div className="social-bottom-actions"><button type="button" className="social-primary" onClick={onPlay}>▶ УРАЛДАХ</button><span>Зочны профайл · Энэ хөтөчид хадгалагдана</span></div>
  </div>;
}

export function StatsPage({profile,best,onPlay}:Pick<BaseProps,'profile'|'best'|'onPlay'>) {
  const quick = orderedHistory(profile);
  const history = profile.history.slice(0,20);
  const speeds = quick.map(x=>x.wpm);
  const maxWpm = Math.max(1,...history.map(h=>h.wpm));
  const percent = avg(quick.map(h=>h.accuracy));
  return <div className="social-page" data-testid="stats-page">
    <header className="social-heading"><span className="social-eyebrow">МИНИЙ ГҮЙЦЭТГЭЛ</span><h1>СТАТИСТИК</h1></header>
    <div className="social-stats-row">
      <div><span>РЕКОРД</span><strong>{best}<small> WPM</small></strong></div>
      <div><span>ДУНДАЖ ХУРД</span><strong>{avg(speeds)}<small> WPM</small></strong></div>
      <div><span>НАРИЙВЧЛАЛ</span><strong>{percent}%</strong></div>
      <div><span>ГАРАА</span><strong>{profile.races}</strong></div>
    </div>
    <section className="social-surface">
      <div className="social-card-heading"><h2>СҮҮЛИЙН ГАРААНУУД</h2><span>{history.length}/20</span></div>
      {history.length ? <div className="social-bars" role="list" aria-label="Сүүлийн уралдаануудын хурд">
        {[...history].reverse().map(h=><div role="listitem" key={h.id} className="social-bar-col" title={h.wpm+' WPM · '+h.accuracy+'%'}>
          <span style={{height:Math.max(3,h.wpm/maxWpm*100)+'%'}}/><small>{h.wpm}</small>
        </div>)}
      </div> : <div className="social-empty">Эхний уралдаанаа дуусгаарай.</div>}
    </section>
    <section className="social-surface">
      <div className="social-card-heading"><h2>УРАЛДААНЫ ТҮҮХ</h2><span>СҮҮЛИЙН {Math.min(history.length,10)}</span></div>
      {history.length ? <div className="social-history">
        {history.slice(0,10).map(h=><div key={h.id}>
          <span>{new Date(h.at).toLocaleDateString('mn-MN',{timeZone:'Asia/Ulaanbaatar',month:'short',day:'numeric'})}</span>
          <strong>{h.wpm} WPM</strong><span>{h.accuracy}%</span><b>+{h.earnedXp} XP</b>
        </div>)}
      </div> : <div className="social-empty">Өгөгдөл алга.</div>}
    </section>
    <button className="social-primary social-play-bottom" type="button" onClick={onPlay}>▶ ДАХИН УРАЛДАХ</button>
    <p className="social-footnote">Зөвхөн энэ төхөөрөмжид бүртгэсэн үр дүн. Албан ёсны рейтинг биш.</p>
  </div>;
}

export function LeaderboardPage({profile,outcome,onPlay}:{
  profile:Profile; outcome: QuickRaceOutcome|null; onPlay:()=>void;
}) {
  const [tab,setTab]=useState<'match'|'personal'>('match');
  const standing = outcome ? raceStandings(outcome) : [];
  const bestHistory = [...orderedHistory(profile)].sort((a,b)=>b.wpm-a.wpm).slice(0,10);
  return <div className="social-page" data-testid="leaderboard-page">
    <header className="social-heading"><span className="social-eyebrow">УРАЛДААНЫ ҮР ДҮН</span><h1>ЧАНСАА</h1></header>
    <div className="social-tabs" role="group" aria-label="Чансааны төрөл">
      <button type="button" className={tab==='match'?'active':''} onClick={()=>setTab('match')}>СҮҮЛИЙН ТОГЛОЛТ</button>
      <button type="button" className={tab==='personal'?'active':''} onClick={()=>setTab('personal')}>МИНИЙ РЕКОРДУУД</button>
    </div>
    <section className="social-surface">
      {tab==='match'? (standing.length ? <ol className="social-ranking">
        {standing.map(({player,position,finished,percent})=><li key={player.id} className={player.id===outcome?.playerId?'me':''}>
          <span className="social-rank">#{position}</span>
          <img src={player.car && player.car in CARS ? CARS[player.car as keyof typeof CARS].icon : CARS.sunset.icon} alt=""/>
          <strong>{player.name}{player.id===outcome?.playerId?' · ТА':''}</strong>
          <small>{player.bot?'БОТ':'ХҮН'}</small><span>{finished?percent+'%':'ДУУСААГҮЙ'}</span>
        </li>)}
      </ol>:<div className="social-empty">Сүүлчийн уралдааны дүн хараахан алга.</div>)
        :(bestHistory.length ? <ol className="social-ranking social-personal-ranking">
          {bestHistory.map((h,i)=><li key={h.id}><span className="social-rank">#{i+1}</span>
            <strong>{h.wpm} WPM</strong><small>{h.accuracy}%</small><span>{new Date(h.at).toLocaleDateString('mn-MN',{timeZone:'Asia/Ulaanbaatar'})}</span></li>)}
        </ol>:<div className="social-empty">Таны бүртгэсэн уралдаан алга.</div>)}
    </section>
    <div className="social-bottom-actions"><button type="button" className="social-primary" onClick={onPlay}>▶ УРАЛДАХ</button>
      <span>Зөвхөн сүүлийн бодит тоглолт ба өөрийн рекорд. Global leaderboard-д бүртгэл/баталгаажуулалт шаардлагатай.</span>
    </div>
  </div>;
}

export function FriendsPage({onCreateRoom,onJoinRoom,onLobby}:{
  onCreateRoom:()=>void; onJoinRoom:(code:string)=>void; onLobby:()=>void;
}) {
  const [code,setCode]=useState('');
  const valid=/^[A-F0-9]{8}$/.test(code);
  return <div className="social-page" data-testid="friends-page">
    <header className="social-heading"><span className="social-eyebrow">PRIVATE RACE</span><h1>НАЙЗУУД</h1></header>
    <div className="social-two-grid social-friend-choices">
      <section className="social-surface social-friend-card">
        <span className="social-eyebrow">01 / ХОСТ</span><h2>ӨРӨӨ ҮҮСГЭХ</h2>
        <div className="social-friend-art"><img src="/cars/graphite-r.svg" alt=""/><img src="/cars/blue-sprint.svg" alt=""/></div>
        <button type="button" className="social-primary" onClick={onCreateRoom}>+ ШИНЭ ӨРӨӨ <span aria-hidden="true">→</span></button>
      </section>
      <section className="social-surface social-friend-card">
        <span className="social-eyebrow">02 / НЭГДЭХ</span><h2>КОД ОРУУЛАХ</h2>
        <form className="social-join-form" onSubmit={e=>{e.preventDefault();if(valid)onJoinRoom(code);}}>
          <label htmlFor="friend-code">8 ТЭМДЭГТ ӨРӨӨНИЙ КОД</label>
          <input id="friend-code" aria-label="Найзын өрөөний код" maxLength={8} autoCapitalize="characters"
            value={code} placeholder="XXXXXXXX"
            onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,8))}/>
          <button type="submit" disabled={!valid}>ӨРӨӨНД НЭГДЭХ →</button>
        </form>
      </section>
    </div>
    <div className="social-bottom-actions"><button type="button" onClick={onLobby}>ӨРӨӨНИЙ ХУУДАС ↗</button>
      <span>Зочны өрөө: урилгаар 2–6 хүн. Бүртгэлтэй найзын жагсаалт одоогоор байхгүй.</span>
    </div>
  </div>;
}
