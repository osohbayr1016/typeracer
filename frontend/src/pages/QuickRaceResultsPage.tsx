import { CARS, type Skin } from './cars';
import { claimAvailableRewards, DAILY_QUESTS, dailyQuests, playerLevel, quickDayStreak, seasonProgress,
  type DailyQuestId, type Profile } from '../progression';
import { raceStandings, type QuickRaceOutcome } from './quickResultsModel';
import './QuickRaceResultsPage.css';

type Props = {
  outcome: QuickRaceOutcome | null;
  profile: Profile;
  nickname: string;
  best: number;
  onAgain: () => void;
  onHome: () => void;
  onGarage: () => void;
  onSeason: () => void;
  onClaimQuest: (id: DailyQuestId) => void;
  onClaimSeason: () => void;
};

function carIcon(value?: string) {
  return value && value in CARS ? CARS[value as Skin].icon : CARS.sunset.icon;
}

export function QuickRaceResultsPage({
  outcome, profile, nickname, best, onAgain, onHome, onGarage, onSeason, onClaimQuest, onClaimSeason
}: Props) {
  if (!outcome) return <section className="qr-empty" data-testid="quick-results-empty">
    <span className="qr-eyebrow">ҮР ДҮН / ОЛДСОНГҮЙ</span>
    <h1>УРАЛДААНЫ МЭДЭЭЛЭЛ АЛГА.</h1>
    <p>Үр дүн нь зөвхөн энэ таб дахь дууссан тоглолтын дараа нээгдэнэ.</p>
    <button type="button" className="primary-button" onClick={onAgain}>▶ УРАЛДААНД ОРОХ</button>
  </section>;

  const { result, snapshot, playerId, at } = outcome;
  const standings = raceStandings(outcome);
  const finished = result.place !== null;
  const entry = profile.history.find(history => history.id === 'quick:' + result.raceId);
  // Earned XP and credited coins come from the deduplicated device-local ledger.
  const earnedXp = entry?.earnedXp ?? 0;
  const earnedCoins = entry?.earnedCoins ?? 0;
  const level = playerLevel(profile.xp);
  const currentLevelXp = profile.xp % 300;
  const pass = seasonProgress(profile, at);
  const streak = quickDayStreak(profile, at);
  const quests = dailyQuests(profile, at);
  const claimedCount = quests.filter(q => q.claimed).length;
  const average = profile.history.length
    ? Math.round(profile.history.reduce((sum, race) => sum + race.wpm, 0) / profile.history.length) : 0;
  const podium = standings.slice(0, 5);
  const myCar = carIcon(standings.find(row => row.player.id === playerId)?.player.car || profile.car);
  const seasonClaimable = pass.claimable.length;

  return <div className="qr-results" data-testid="quick-results" aria-labelledby="qr-results-title">
    <header className="qr-heading">
      <div>
        <span className="qr-eyebrow"><span className="qr-live-dot" aria-hidden="true"/> УРАЛДААНЫ ТАЙЛАН <span aria-hidden="true">/</span> PUBLIC QUICK PLAY</span>
        <h1 id="qr-results-title">{finished ? 'БАРИАНД ОРЛОО.' : 'ХУГАЦАА ДУУССАН.'}</h1>
        <p>{finished ? 'Таны бичилтийг сервер баталгаажуулсан. Дараагийн гараанд бэлдээрэй.' :
          'Энэ удаад текстээ бүрэн дуусгаагүй. Дахин оролдоод ахицаа нэмээрэй.'}</p>
      </div>
      <span className="qr-event-mark">MN <strong>01</strong></span>
    </header>

    <div className="qr-layout">
      <div className="qr-main-column">
        <section className="qr-hero" aria-label="Таны уралдааны дүн">
          <div className="qr-hero-left">
            <span className="qr-caption">{finished ? 'ТАНЫ БАЙР · СЕРВЕРИЙН ҮР ДҮН' : 'ДУУСААГҮЙ'}</span>
            <div className="qr-place">{finished ? <><span>#</span>{result.place}</> : '—'}</div>
            <div className="qr-car-stage">
              <span className="qr-stage-label">TYPE FAST · FINISH STRONG</span>
              <div className="qr-stage-road" aria-hidden="true"/>
              <img src={myCar} alt="Уралдаанд ашигласан машин" className="qr-stage-car"/>
              <span className="qr-stage-checker" aria-hidden="true"/>
            </div>
          </div>
          <div className="qr-hero-right">
            <span className="qr-caption">ЭНЭ ГАРААНЫ ҮЗҮҮЛЭЛТ</span>
            <div className="qr-wpm"><strong>{result.wpm}</strong><span>WPM</span></div>
            <div className="qr-hero-metrics">
              <div><span>НАРИЙВЧЛАЛ</span><strong>{result.accuracy}%</strong></div>
              <div><span>ХУГАЦАА</span><strong>{(result.elapsedMs / 1000).toFixed(1)}с</strong></div>
              <div><span>ХУВИЙН РЕКОРД</span><strong>{best} <small>WPM</small></strong></div>
            </div>
            <div className="qr-earned" aria-label="Энэ уралдааны бодитой бүртгэгдсэн шагнал">
              <div><span>ОЛСОН XP</span><strong>+{earnedXp} XP</strong></div>
              <div><span>ОЛСОН ЗООС</span><strong>◈ +{earnedCoins}</strong></div>
            </div>
          </div>
        </section>

        <section className="qr-panel qr-standing-panel" aria-labelledby="qr-standings-title">
          <div className="qr-panel-header">
            <div><span className="qr-eyebrow">ҮР ДҮН / 01</span><h2 id="qr-standings-title">УРАЛДАГЧДЫН БАЙРЛАЛ</h2></div>
            <span className="qr-subtle">{snapshot.players.length} УРАЛДАГЧ</span>
          </div>
          <ol className="qr-standings">
            {podium.map(({player, position, progress, finished: racerFinished, percent}) =>
              <li key={player.id} className={'qr-standing' + (player.id === playerId ? ' own' : '')}>
                <span className="qr-standing-position">{String(position).padStart(2, '0')}</span>
                <div className="qr-standing-car"><img src={carIcon(player.car)} alt=""/></div>
                <div className="qr-standing-user">
                  <strong>{player.id === playerId ? nickname + ' · ТА' : player.name}</strong>
                  <span>{player.bot ? 'БОТ' : 'ТОГЛОГЧ'} <i aria-hidden="true">·</i> {racerFinished ? 'БАРИАНД ОРСОН' : 'ДУУСААГҮЙ'}</span>
                </div>
                <div className="qr-standing-progress"><span style={{ width: percent + '%' }}/></div>
                <span className="qr-standing-status">{racerFinished ? '✓ ' + percent + '%' : progress + ' ТЭМДЭГТ'}</span>
              </li>)}
          </ol>
          <p className="qr-standing-note">Байрыг серверийн барианд орсон хугацаагаар эрэмбэлэв. Дуусаагүй өрсөлдөгчид тухайн үеийн явцаар харагдана; эдгээр нь баталгаажсан барианы байр биш. Зочны уралдаан тул албан ёсны рейтинг биш.</p>
        </section>

        <nav className="qr-actions" aria-label="Уралдааны дараах үйлдлүүд">
          <button type="button" className="qr-play-again" onClick={onAgain}>▶ ДАХИН УРАЛДАХ <span aria-hidden="true">→</span></button>
          <button type="button" onClick={onHome}>⌂ НҮҮР ХУУДАС</button>
          <button type="button" onClick={onGarage}>ГАРАЖ ↗</button>
        </nav>
      </div>

      <aside className="qr-side-column" aria-label="Хувийн ахиц, шагнал болон даалгавар">
        <section className="qr-panel qr-level-panel">
          <div className="qr-panel-header"><div><span className="qr-eyebrow">ХУВИЙН АХИЦ</span><h2>ТҮВШИН {level}</h2></div><span className="qr-level-number">LVL {level}</span></div>
          <div className="qr-progress-label"><span>ДАРААГИЙН ТҮВШИН</span><strong>{currentLevelXp} / 300 XP</strong></div>
          <div className="qr-progress-track" role="progressbar" aria-label="Дараагийн түвшний XP" aria-valuemin={0} aria-valuemax={300} aria-valuenow={currentLevelXp}><span style={{width:(currentLevelXp / 3)+'%'}}/></div>
          <p>{Math.max(0,300 - currentLevelXp)} XP цуглуулбал түвшин {level + 1} болно.</p>
        </section>

        <section className="qr-panel qr-pass-panel">
          <div className="qr-panel-header"><div><span className="qr-eyebrow">УЛИРАЛ 01 · ҮНЭГҮЙ</span><h2>BATTLE PASS</h2></div><span className="qr-pass-tier">{pass.unlocked.length}/8</span></div>
          <div className="qr-progress-label"><span>{pass.next ? 'ДАРААГИЙН ШАТ · ' + pass.next.tier : 'БҮХ ШАТ НЭЭГДСЭН'}</span><strong>{pass.next ? pass.xpToNext + ' XP ҮЛДСЭН' : '100%'}</strong></div>
          <div className="qr-progress-track qr-season-track" role="progressbar" aria-label="Улирлын нийт ахиц" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pass.totalPercent)}><span style={{width:pass.totalPercent+'%'}}/></div>
          {seasonClaimable > 0 && <button type="button" className="qr-claim-pass" onClick={onClaimSeason}>✓ {seasonClaimable} ШАГНАЛ АВАХ</button>}
          <button type="button" className="qr-text-link" onClick={onSeason}>ШАГНАЛЫН ЗАМ ХАРАХ <span aria-hidden="true">↗</span></button>
        </section>

        <section className="qr-panel qr-quest-panel" data-testid="quick-daily-quests">
          <div className="qr-panel-header"><div><span className="qr-eyebrow">ӨНӨӨДӨР / МОНГОЛЫН ЦАГ</span><h2>ӨДРИЙН ДААЛГАВАР</h2></div><span className="qr-quest-counter">{claimedCount}/{DAILY_QUESTS.length}</span></div>
          <ul className="qr-quest-list">
            {quests.map(quest => <li key={quest.id} className={'qr-quest'+(quest.claimed?' claimed':'')} data-quest-id={quest.id}>
              <div className="qr-quest-row">
                <div><strong>{quest.name}</strong><span>{quest.detail}</span></div>
                <span className="qr-quest-value">◈ {quest.coins}</span>
              </div>
              <div className="qr-quest-bottom">
                <div className="qr-mini-track" role="progressbar" aria-label={quest.name+' явц'} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={quest.progress}><span style={{width:quest.progress/quest.target*100+'%'}}/></div>
                <button type="button" disabled={!quest.done || quest.claimed} onClick={() => onClaimQuest(quest.id)}>
                  {quest.claimed ? '✓ АВСАН' : quest.done ? 'ШАГНАЛ АВАХ' : quest.progress + '/' + quest.target}
                </button>
              </div>
            </li>)}
          </ul>
        </section>

        <section className="qr-panel qr-stats-panel">
          <div className="qr-panel-header"><div><span className="qr-eyebrow">ЭНЭ ТӨХӨӨРӨМЖ</span><h2>МИНИЙ СТАТИСТИК</h2></div></div>
          <div className="qr-stats-grid">
            <div><span>ӨДРИЙН STREAK</span><strong>{streak}<small> өдөр</small></strong></div>
            <div><span>НИЙТ ГАРАА</span><strong>{profile.races}</strong></div>
            <div><span>СҮҮЛИЙН ДУНДАЖ</span><strong>{average}<small> WPM</small></strong></div>
          </div>
        </section>
      </aside>
    </div>
    <p className="qr-footer-note">Зоос, XP, даалгавар, streak энэ хөтөчид хадгалагдана. Албан ёсны rank, баталгаатай мөнгөн шагнал эсвэл төхөөрөмж хоорондын sync биш.</p>
  </div>;
}
