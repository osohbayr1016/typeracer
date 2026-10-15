import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { HomePage } from './pages/HomePage';
import { SiteNavigation } from './SiteNavigation';
import { QuickRacePage, type QuickResult } from './pages/QuickRacePage';
import { QuickRaceResultsPage } from './pages/QuickRaceResultsPage';
import { type QuickRaceOutcome } from './pages/quickResultsModel';
import { ProfilePage, StatsPage, FriendsPage } from './pages/SocialPages';
import { GlobalLeaderboardPage, TeamsPage } from './pages/RankingsPages';
import { PlayPage } from './pages/PlayPage';
import { GaragePage } from './pages/GaragePage';
import { ResultsPage } from './pages/ResultsPage';
import { ShopPage } from './pages/ShopPage';
import { SeasonPage } from './pages/SeasonPage';
import { loadProfile, saveProfile, raceReward, awardQuickRace, buyItem, claimReward, claimAvailableRewards, equipItem,
  TITLE_NAMES, STICKER_SYMBOLS, claimDailyQuest, type DailyQuestId, type CosmeticKind, type Cosmetic } from './progression';
import { CARS, raceCarIcon, type Skin } from './pages/cars';
import { readRaceClock, useRaceStart, type ServerClock } from './pages/useRaceStart';
import {
  accuracyPercent, characters, choosePrompt, normalizeText, progressPercent,
  PROMPTS, wordsPerMinute, type Language, type Prompt, type RoomSnapshot
} from '@typeracer/shared';

type Page = 'home' | 'play' | 'quickRace' | 'quickResults' | 'profile' | 'leaderboard' | 'teams' | 'stats' | 'friends' | 'race' | 'garage' | 'results' | 'shop' | 'season' | 'multiplayer' | 'multiplayerRace';
const PAGE_URLS: Record<Page, string> = {
  home: '/', play: '/play', quickRace: '/quick-race', quickResults: '/quick-results',
  profile: '/profile', leaderboard: '/leaderboard', teams: '/teams', stats: '/stats', friends: '/friends',
  race: '/race', garage: '/garage', results: '/results',
  shop: '/shop', season: '/season',
  multiplayer: '/multiplayer', multiplayerRace: '/multiplayer/race'
};
function routeFromLocation(): Page {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (new URLSearchParams(window.location.search).has('room')) return 'multiplayer';
  return (Object.entries(PAGE_URLS).find(([, url]) => url === path)?.[0] || 'home') as Page;
}
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const roomCodePattern = /^[A-F0-9]{8}$/;
function storedNumber(key: string): number {
  try { return Math.max(0, Number(localStorage.getItem(key)) || 0); }
  catch { return 0; }
}
function PhraseView({ prompt, typed, progress = null }: {
  prompt: Prompt; typed: string; progress?: number | null
}) {
  const done = characters(typed);
  return <div className="phrase" role="group" aria-label="Бичих текст">
    {characters(prompt.text).map((letter, index) => {
      const className = progress !== null
        ? index < progress ? 'letter correct' : index === progress ? 'letter cursor' : 'letter'
        : index < done.length
          ? done[index] === letter ? 'letter correct' : 'letter incorrect'
          : index === done.length ? 'letter cursor' : 'letter';
      return <span key={index} className={className}>{letter === ' ' ? '\u00a0' : letter}</span>;
    })}
  </div>;
}
function Lane({ name, progress, color, icon, subtitle, isYou, position = 1, trail = 'none', sticker = '' }: {
  name: string; progress: number; color: string; icon: string; subtitle: string; isYou?: boolean;
  position?: number; trail?: string; sticker?: string
}) {
  return <div className={'lane ' + (isYou ? 'you' : '')} style={{ '--lane-color': color } as CSSProperties}>
    <div className="lane-header">
      <span className="lane-position">{String(position).padStart(2, '0')}</span>
      <div className="lane-details">
        <div className="lane-name-row"><span className="lane-name">{name}</span>{isYou && <span className="you-tag">★</span>}</div>
        <span className="lane-detail">{subtitle}</span>
        <div className="lane-progress-track" aria-hidden="true"><span style={{ width: progress + '%' }}/></div>
      </div>
      <span className="lane-percentage">{progress}%</span>
    </div>
    <div className={'lane-road trail-' + trail} aria-label={name + ': ' + progress + '%'}>
      <div className="lane-progress" style={{ width: progress + '%' }}/>
      <span className="race-trail" style={{ left: (2 + progress * .76) + '%' }} aria-hidden="true"/>
      <img className="lane-car" style={{ left: (2 + progress * .76) + '%' }} src={icon} alt="" aria-hidden="true" draggable={false}/>
      {sticker && <span className="race-sticker" style={{ left: (2 + progress * .76) + '%' }} aria-hidden="true">{sticker}</span>}
      <span className="finish-flag" aria-hidden="true"/>
    </div>
  </div>;
}

export function App() {
  const [page, setPage] = useState<Page>(routeFromLocation);
  const [countdown, setCountdown] = useState<number | null>(() => routeFromLocation() === 'race' ? 3 : null);
  const [language, setLanguage] = useState<Language>('mn');
  const [prompt, setPrompt] = useState<Prompt>(() => choosePrompt('mn', 0));
  const [typed, setTyped] = useState('');
  const [strokes, setStrokes] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState(() => storedNumber('racer.best'));
  const [profile, setProfile] = useState(loadProfile);
  const [quickOutcome, setQuickOutcome] = useState<QuickRaceOutcome | null>(null);
  const xp = profile.xp;
  const skin = profile.car;
  const inputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(() => {
    try { return localStorage.getItem('racer.nickname')?.slice(0, 20) || 'Зочин'; } catch { return 'Зочин'; }
  });
  const [joinCode, setJoinCode] = useState(() => (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 8));
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [onlineClock, setOnlineClock] = useState<ServerClock | null>(null);
  const onlineSnapshotRef = useRef<RoomSnapshot | null>(null);
  const onlineCompositionBeforeStart = useRef(false);
  const { canType: onlineCanType } = useRaceStart(snapshot?.phase, snapshot?.startAt, onlineClock);
  const [myId, setMyId] = useState('');
  const [raceResult, setRaceResult] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 125);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);
  useEffect(() => () => socketRef.current?.close(), []);
  useEffect(() => {
    if (snapshot?.phase !== 'racing') return;
    const id = window.setInterval(() => setNow(Date.now()), 125);
    return () => window.clearInterval(id);
  }, [snapshot?.phase]);
  const target = useMemo(() => characters(prompt.text), [prompt]);
  const entered = useMemo(() => characters(typed), [typed]);
  const firstMismatch = entered.findIndex((letter, index) => letter !== target[index]);
  const correct = firstMismatch === -1 ? entered.length : firstMismatch;
  const elapsed = startedAt === null ? 0 : (finishedAt ?? now) - startedAt;
  const wpm = wordsPerMinute(correct, elapsed);
  const accuracy = accuracyPercent(Math.max(0, strokes - mistakes), strokes);
  const progress = progressPercent(correct, prompt.text);
  const ghostProgress = (pace: number) => Math.min(100, Math.round(elapsed / 60000 * pace * 5 / Math.max(1, target.length) * 100));
  const level = Math.floor(xp / 300) + 1;
  useEffect(() => saveProfile(profile), [profile]);
  const myPlayer = snapshot?.players.find(p => p.id === myId);
  const onlineWpm = myPlayer && snapshot?.startAt
    ? wordsPerMinute(myPlayer.progress, Math.max(1, (myPlayer.completedAt ?? readRaceClock(onlineClock)) - snapshot.startAt)) : 0;
  const onlineAccuracy = myPlayer ? accuracyPercent(Math.max(0, myPlayer.strokes - myPlayer.mistakes), myPlayer.strokes) : 100;
  useEffect(() => {
    if (page === 'multiplayerRace' && onlineCanType && !window.matchMedia('(pointer: coarse)').matches)
      onlineInputRef.current?.focus({ preventScroll: true });
  }, [page, onlineCanType]);
  useEffect(() => {
    if (page !== 'results' || finishedAt === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) startSolo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, finishedAt, language, prompt.id]);
  function resetPractice(nextLanguage = language, shouldFocus = true) {
    const pool = PROMPTS[nextLanguage].filter(item => item.id !== prompt.id);
    const next = pool[Math.floor(Math.random() * pool.length)] || choosePrompt(nextLanguage);
    setLanguage(nextLanguage);
    setPrompt(next);
    setTyped(''); setStrokes(0); setMistakes(0); setStartedAt(null); setFinishedAt(null); setNow(Date.now());
    if (shouldFocus) window.setTimeout(() => inputRef.current?.focus(), 10);
  }
  function updateTypingValue(rawValue: string) {
    if (finishedAt !== null) return;
    const value = normalizeText(rawValue);
    if (characters(value).length > target.length) return;
    if (startedAt === null && value.length > 0) setStartedAt(Date.now());
    const input = characters(value);
    if (input.length > entered.length) {
      const additions = input.slice(entered.length);
      setStrokes(count => count + additions.length);
      setMistakes(count => count + additions.filter((letter, offset) => letter !== target[entered.length + offset]).length);
    }
    setTyped(value);
    if (value === prompt.text) {
      const end = Date.now();
      setFinishedAt(end);
      const score = wordsPerMinute(target.length, Math.max(1, end - (startedAt ?? end)));
      if (score > best) {
        setBest(score);
        try { localStorage.setItem('racer.best', String(score)); } catch { /* storage unavailable */ }
      }
      setProfile(prev => raceReward(prev, {
        wpm: score, accuracy: accuracyPercent(Math.max(0, strokes + 1 - mistakes), strokes + 1),
        elapsedMs: Math.max(1, end - (startedAt ?? end)), at: end
      }));
    }
  }
  function updateTyping(event: ChangeEvent<HTMLInputElement>) {
    if ((event.nativeEvent as InputEvent).isComposing) return;
    updateTypingValue(event.target.value);
  }
  function handleEquip(kind: CosmeticKind, id: string) { setProfile(p => equipItem(p, kind, id)); }
  function handleBuy(item: Cosmetic) { setProfile(p => buyItem(p, item.kind, item.id)); }
  function handleClaim(tier: number) { setProfile(p => claimReward(p, tier)); }
  function handleClaimAll() { setProfile(p => claimAvailableRewards(p)); }
  function handleQuestClaim(id: DailyQuestId) { setProfile(p => claimDailyQuest(p, id)); }
  function disconnect() {
    socketRef.current?.close(); socketRef.current = null;
    setStatus('disconnected'); setSnapshot(null); setCode(''); setMyId(''); setRaceResult(null);
    onlineSnapshotRef.current = null; setOnlineClock(null);
  }
  function connectRoom(roomCode: string) {
    const clean = roomCode.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) { setError('Өрөөний код 8 тэмдэгттэй байх ёстой.'); return; }
    disconnect(); setCode(clean); setError(''); setStatus('connecting');
    const base = API_BASE || window.location.origin;
    const url = base.replace(/^http/, 'ws') + '/api/rooms/' + clean + '/ws?' +
      new URLSearchParams({ name: nickname, car: profile.car, trail: profile.trail,
        sticker: profile.sticker, title: profile.title }).toString();
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch { setError('Сервертэй холбогдож чадсангүй.'); setStatus('disconnected'); return; }
    socketRef.current = socket;
    socket.onopen = () => { setStatus('connected'); setError(''); };
    socket.onmessage = event => {
      try {
        const value = JSON.parse(event.data) as RoomSnapshot | { type: 'welcome'; id: string } | { type: 'result'; wpm: number };
        if (value.type === 'welcome') setMyId(value.id);
        if (value.type === 'state') {
          if (!onlineSnapshotRef.current || value.startAt !== onlineSnapshotRef.current.startAt)
            setOnlineClock({ serverNow: value.serverNow ?? Date.now(), receivedAt: performance.now() });
          if (value.matchId !== onlineSnapshotRef.current?.matchId) {
            setRaceResult(null);
            if (onlineInputRef.current) onlineInputRef.current.value = '';
          }
          onlineSnapshotRef.current = value;
          setSnapshot(value);
        }
        if (value.type === 'result') setRaceResult(value.wpm);
      } catch { setError('Серверийн хариу ойлгомжгүй байна.'); }
    };
    socket.onclose = () => { if (socketRef.current === socket) setStatus('disconnected'); };
    socket.onerror = () => setError('Холболт тасарсан эсвэл өрөө дүүрсэн байна. API серверээ шалгана уу.');
  }
  async function createRoom() {
    setError('');
    try {
      const response = await fetch(API_BASE + '/api/rooms', { method: 'POST' });
      if (!response.ok) throw new Error('Сервер шинэ өрөө үүсгэж чадсангүй (' + response.status + ')');
      const data: { code: string } = await response.json();
      connectRoom(data.code);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Сервертэй холбогдох боломжгүй.'); }
  }
  function submitOnlineInput(event: ChangeEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    if (!onlineCanType || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      element.value = ''; return;
    }
    if ((event.nativeEvent as InputEvent).isComposing) return;
    const value = characters(element.value);
    element.value = '';
    for (const key of value.slice(0, 8)) socketRef.current.send(JSON.stringify({ type: 'key', key }));
  }
  function ready() { socketRef.current?.send(JSON.stringify({ type: 'ready' })); }
  async function copyCode() {
    try { await navigator.clipboard.writeText(window.location.origin + '/multiplayer?room=' + code); } catch { setError('Урилгын холбоосыг гараар хуулна уу.'); }
  }


  useEffect(() => {
    const onPopstate = () => {
      const next = routeFromLocation();
      if (next !== 'multiplayer' && next !== 'multiplayerRace' && socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setStatus('disconnected'); setSnapshot(null); setCode(''); setMyId(''); setRaceResult(null);
      }
      setPage(next);
    };
    window.addEventListener('popstate', onPopstate);
    return () => window.removeEventListener('popstate', onPopstate);
  }, []);
  useEffect(() => {
    if (page !== 'race' || countdown === null) return;
    const timer = window.setTimeout(() => {
      if (countdown === 0) { setCountdown(null); inputRef.current?.focus(); }
      else setCountdown(countdown - 1);
    }, countdown === 0 ? 420 : 850);
    return () => window.clearTimeout(timer);
  }, [page, countdown]);
  useEffect(() => {
    if (page !== 'race' || finishedAt === null) return;
    const timer = window.setTimeout(() => navigate('results'), 850);
    return () => window.clearTimeout(timer);
  }, [page, finishedAt]);
  useEffect(() => {
    if (page === 'multiplayer' && snapshot?.phase === 'countdown')
      navigate('multiplayerRace');
  }, [page, snapshot?.phase]);
  function navigate(next: Page) {
    if (next === 'multiplayer' && status === 'connected' &&
        (snapshot?.phase === 'countdown' || snapshot?.phase === 'racing')) next = 'multiplayerRace';
    if ((page === 'multiplayer' || page === 'multiplayerRace') &&
        next !== 'multiplayer' && next !== 'multiplayerRace') disconnect();
    const url = PAGE_URLS[next];
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function startSolo() {
    resetPractice('mn', false);
    setCountdown(3);
    navigate('race');
  }
  function updateNickname(value: string) {
    setNickname(value);
    try { localStorage.setItem('racer.nickname', value); } catch { /* private mode */ }
  }

  return <div className="app-shell" style={{ '--accent': CARS[skin].color } as CSSProperties}>
    <SiteNavigation page={page} nickname={nickname} level={level} coins={profile.coins}
      onNavigate={destination => navigate(destination)}/>
    <main className="shell main">
      {page === 'home' && <HomePage onPlay={() => navigate('play')}
        onMultiplayer={() => navigate('friends')}/>}
      {page === 'play' && <PlayPage best={best} carIcon={raceCarIcon(skin)} carName={CARS[skin].label}
        onPlay={() => navigate('quickRace')} onMultiplayer={() => navigate('multiplayer')}
        onCreateRoom={() => { navigate('multiplayer'); void createRoom(); }}
        onJoinRoom={room => { navigate('multiplayer'); setJoinCode(room); connectRoom(room); }}
        onGarage={() => navigate('garage')}/>}
      {page === 'profile' && <ProfilePage profile={profile} nickname={nickname} best={best}
        onNameChange={updateNickname} onPlay={() => navigate('quickRace')}
        onGarage={() => navigate('garage')} onSeason={() => navigate('season')} onStats={() => navigate('stats')}/>}
      {page === 'stats' && <StatsPage profile={profile} best={best} onPlay={() => navigate('quickRace')}/>}
      {page === 'leaderboard' && <GlobalLeaderboardPage profile={profile} outcome={quickOutcome}
        onPlay={() => navigate('quickRace')} onTeams={() => navigate('teams')}/>}
      {page === 'teams' && <TeamsPage onPlay={() => navigate('quickRace')}/>}
      {page === 'friends' && <FriendsPage
        onCreateRoom={() => { navigate('multiplayer'); void createRoom(); }}
        onJoinRoom={room => { navigate('multiplayer'); setJoinCode(room); connectRoom(room); }}
        onLobby={() => navigate('multiplayer')}/>}
      {page === 'quickResults' && <QuickRaceResultsPage outcome={quickOutcome} nickname={nickname} profile={profile} best={best}
        onAgain={() => { setQuickOutcome(null); navigate('quickRace'); }}
        onHome={() => navigate('home')} onGarage={() => navigate('garage')}
        onSeason={() => navigate('season')} onClaimQuest={handleQuestClaim} onClaimSeason={handleClaimAll}/>}
      {page === 'quickRace' && <QuickRacePage nickname={nickname} car={skin} profile={profile}
        onBack={() => navigate('play')} onGarage={() => navigate('garage')}
        onFinish={outcome => { setQuickOutcome(outcome); navigate('quickResults'); }}
        onReward={(result: QuickResult) => {
          setProfile(prev => awardQuickRace(prev, { ...result, at: Date.now() }));
          if (result.place !== null && result.wpm > best) {
            setBest(result.wpm);
            try { localStorage.setItem('racer.best', String(result.wpm)); } catch { /* storage disabled */ }
          }
        }}/>} 
      {page === 'garage' && <GaragePage profile={profile} onEquip={handleEquip} onPlay={() => navigate('play')}
        onShop={() => navigate('shop')} onSeason={() => navigate('season')}/>}
      {page === 'shop' && <ShopPage profile={profile} onBuy={handleBuy}
        onEquip={item => handleEquip(item.kind, item.id)} onRace={() => navigate('play')}/>}
      {page === 'season' && <SeasonPage profile={profile} onClaim={handleClaim} onClaimAll={handleClaimAll}
        onRace={() => navigate('play')} onShop={() => navigate('shop')}/>}

      {page === 'results' && <ResultsPage wpm={wpm} accuracy={accuracy} elapsed={elapsed} best={best} correct={correct} carIcon={CARS[skin].icon} earnedXp={profile.history[0]?.earnedXp || 0} earnedCoins={profile.history[0]?.earnedCoins || 0}
        onAgain={startSolo} onPlay={() => navigate('play')} onGarage={() => navigate('garage')} />}
      {page === 'race' && <>
        <div className="game-header">
          <button className="back-link" onClick={() => navigate('play')}>← ГОРИМ СОНГОХ</button>
          <span className="section-kicker">01 / ГАНЦААРЧИЛСАН УРАЛДААН · МОНГОЛ ХЭЛ</span>
          <div className="game-timer">{(elapsed / 1000).toFixed(1)}s</div>
        </div>
        <section className="race-panel" aria-label="Ганцаарчилсан бичих уралдаан">
          <div className="race-panel-head">
            <div className="race-title"><span className="race-indicator" aria-hidden="true"/> <h2>УРАЛДААНЫ ЗАМ</h2><span className="race-chip">ГАНЦААРАА</span></div>
            <div className="panel-actions">
<span className="language-note">🇲🇳 МОНГОЛ ХЭЛ</span>
              <button className="text-button" onClick={() => resetPractice()} aria-label="Шинэ текст">↻ Шинэ текст</button>
            </div>
          </div>
          <div className="track-wrap">
            {countdown !== null && <div className="start-countdown" role="status" aria-live="assertive">
              <span>БЭЛДЭЭРЭЙ</span><strong>{countdown === 0 ? 'ЭХЭЛ!' : countdown}</strong><small>Уралдаан эхлэх гэж байна</small>
            </div>}
            <div className="track-meta"><span>ГАРААНД БЭЛД</span><span>БАРИА →</span></div>
            <Lane name={nickname} position={1} progress={progress} color={CARS[skin].color} icon={raceCarIcon(skin)}
              subtitle={TITLE_NAMES[profile.title]} trail={profile.trail} sticker={STICKER_SYMBOLS[profile.sticker]} isYou />
            <Lane name={best > 0 ? 'Хувийн рекорд' : '60 WPM зорилт'} position={2} progress={ghostProgress(best > 0 ? best : 60)}
              color="#d8dce0" icon="/cars/race/purple.webp" subtitle={best > 0 ? 'ӨМНӨХ ХУРД · РЕКОРД' : 'ЗОРИЛТОТ ХУРД · БОДИТ ТОГЛОГЧ БИШ'}/>
            <Lane name="40 WPM зорилт" position={3} progress={ghostProgress(40)}
              color="#4486ef" icon="/cars/race/mint.webp" subtitle="ЗОРИЛТОТ ХУРД · БОДИТ ТОГЛОГЧ БИШ"/>
            <div className="track-note">БУСАД МАШИНУУД БОЛ ЖИШИГ ХУРД, БОДИТ ТОГЛОГЧ БИШ</div>
          </div>
          <div className="typing-area" onClick={() => { if (countdown === null) inputRef.current?.focus(); }}>
            <div className="typing-label"><span><i aria-hidden="true">//</i> МОНГОЛ ӨГҮҮЛБЭР</span><span>{prompt.id.toUpperCase()} · {correct} / {target.length}</span></div>
            <PhraseView prompt={prompt} typed={typed}/>
            <div className="typing-input-row">
              <input ref={inputRef} autoFocus={false} readOnly={countdown !== null} autoCapitalize="off" autoCorrect="off" autoComplete="off"
                spellCheck={false} value={typed} onPaste={e => e.preventDefault()} onChange={updateTyping}
                onCompositionEnd={e => updateTypingValue(e.currentTarget.value)}
                aria-label="Энд бичиж эхлээрэй" className="typing-input"
                placeholder={finishedAt !== null ? 'Барианд орлоо!' : 'Энд бичиж эхлээрэй...'} disabled={finishedAt !== null}/>
              <button className="restart-shortcut" onClick={e => { e.stopPropagation(); resetPractice(); }} aria-label="Шинэ уралдаан эхлүүлэх">↻ <span >Шинээр</span></button>
            </div>
            {finishedAt !== null && <div className="finish-banner" role="status"><strong>Баяр хүргэе! Барианд орлоо · {wpm} WPM · {accuracy}%</strong><button className="primary-button" onClick={e => { e.stopPropagation(); resetPractice(); }} >ДАХИН УРАЛДАХ →</button></div>}
          </div>
          <div className="race-stats" aria-label="Уралдааны үзүүлэлт">
            <div className="stat-block"><strong>{wpm}</strong><span>WPM</span><small>Хурд</small></div>
            <div className="stat-block"><strong>{accuracy}<em>%</em></strong><small>Нарийвчлал</small></div>
            <div className="stat-block stat-progress"><strong>{correct} <em>/ {target.length}</em></strong><small>Тэмдэгт</small><span className="stat-progress-bar" aria-label={'Явц ' + progress + '%'}><span style={{ width: progress + '%' }}/></span></div>
            <div className="stat-block stat-cta"><button className="primary-button race-again" onClick={startSolo} >ДАХИН УРАЛДАХ <span aria-hidden="true">→</span></button></div>
          </div>
        </section>
        <p className="help-note">Ө, Ү үсгийг зөв бичээрэй. Алдааг Backspace дарж засна. Сүнс машинууд бол жишиг хурд бөгөөд бодит өрсөлдөгч биш.</p>


      </>}
      {(page === 'multiplayer' || page === 'multiplayerRace') && <>
        <div className="flow-heading multiplayer-heading">
          <button className="back-link" onClick={() => navigate('play')}>← ГОРИМ СОНГОХ</button>
          <span className="section-kicker">MULTIPLAYER / НАЙЗУУДЫН ӨРӨӨ</span>
          <h1>{page === 'multiplayerRace' ? < >ШУУД <span>УРАЛДААН.</span></> : <>ӨРӨӨ <span>ХҮЛЭЭЛТ.</span></>}</h1>
          <p>2–6 тоглогч · Урилгын код · Бүгд бэлэн болмогц уралдаан эхэлнэ.</p>
        </div>
        <section className="race-panel multiplayer-panel" aria-label="Найзуудтай уралдах">
          <div className="race-panel-head">
            <div className="race-title"><span className="race-indicator"/><h2>Найзуудтайгаа уралд</h2><span className="race-chip">LIVE · 2–6</span></div>
            <span className="unranked-label">Зочны өрөө</span>
          </div>

          {status === 'disconnected' && <div className="lobby-start">
            <div className="lobby-intro">
              <span className="section-kicker">НАЙЗУУДЫН УРАЛДААН</span>
              <h3>УРАЛДААНЫ ӨРӨӨ ҮҮСГЭХ.</h3>
              <p>Найзуудаа өрөөний код эсвэл урилгын холбоосоор уриарай. Дор хаяж хоёр тоглогч цуглаж Ready дармагц уралдаан эхэлнэ.</p>
            </div>
            <label className="field-label" htmlFor="nickname">МИНИЙ ТОГЛОГЧИЙН НЭР</label>
            <input id="nickname" className="field" value={nickname} maxLength={20}
              onChange={e => updateNickname(e.target.value)} aria-label="Тоглогчийн нэр"/>
            <div className="lobby-entry-grid">
              <section className="lobby-entry-card">
                <span className="section-kicker">01 / ӨРӨӨ НЭЭХ</span>
                <h4>Шинэ өрөө нээх</h4>
                <p>Өөрийн өрөөг үүсгээд бусдад урилга илгээнэ.</p>
                <button className="primary-button full" onClick={() => void createRoom()}>+ ӨРӨӨ ҮҮСГЭХ →</button>
              </section>
              <section className="lobby-entry-card">
                <span className="section-kicker">02 / НЭГДЭХ</span>
                <h4>Бэлэн өрөөнд нэгдэх</h4>
                <p>Найзаасаа ирсэн найман тэмдэгттэй кодыг оруулна.</p>
                <label className="field-label" htmlFor="join-code">ӨРӨӨНИЙ КОД</label>
                <input id="join-code" className="field" maxLength={8} value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))}
                  placeholder="A3BF29C1" aria-label="Өрөөний код"/>
                <button className="secondary-button full" disabled={!roomCodePattern.test(joinCode)} onClick={() => connectRoom(joinCode)}>НЭВТРЭХ →</button>
              </section>
            </div>
          </div>}
          {status === 'connecting' && <p className="connection-note">Өрөөнд холбогдож байна…</p>}
          {status === 'connected' && snapshot && <div className="room-active">
            <div className="room-info"><div><small>УРЬХ КОД</small><strong>{code}</strong></div>
              <button className="secondary-button" onClick={() => void copyCode()}>↗ Холбоос хуулах</button></div>
            <div className="room-meta" aria-live="polite">{snapshot.players.length} / 6 тоглогч · {snapshot.phase === 'waiting' ? 'Бэлэн болохыг хүлээж байна' : snapshot.phase === 'countdown' ? 'Уралдаан эхлэх гэж байна' : snapshot.phase === 'racing' ? 'Уралдаж байна' : 'Дууссан'}</div>
            {snapshot.phase === 'waiting' && <div className="lobby-waiting">
              <h3>ӨРӨӨН ДЭХ ТОГЛОГЧИД <span>{snapshot.players.length} / 6</span></h3>
              <div className="lobby-player-grid">
                {snapshot.players.map((player, index) => <div className="lobby-player" key={player.id}>
                  <span className="lobby-player-num">{String(index + 1).padStart(2,'0')}</span>
                  <span className="lobby-player-name">{player.name}{player.id === myId ? ' (YOU)' : ''}</span>
                  <span className={player.ready ? 'lobby-ready ready' : 'lobby-ready'}>{player.ready ? '✓ БЭЛЭН' : 'ХҮЛЭЭЖ БАЙНА'}</span>
                </div>)}
                {snapshot.players.length < 6 && <div className="lobby-player empty"><span>+</span><span>Дээрх кодоор найзаа урина</span></div>}
              </div>
            </div>}
            {snapshot.phase !== 'waiting' && <div className="multiplayer-track">
              {snapshot.players.map((player, index) => {
                const chosenSkin: Skin = player.car && player.car in CARS ? player.car as Skin : (['sunset','purple','mint'] as Skin[])[index % 3];
                const car = CARS[chosenSkin];
                return <Lane key={player.id} name={player.name} position={index + 1} isYou={player.id === myId}
                  trail={player.trail || 'none'} sticker={STICKER_SYMBOLS[player.sticker as keyof typeof STICKER_SYMBOLS] || ''}
                  progress={progressPercent(player.progress, snapshot.prompt.text)}
                  color={car.color} icon={raceCarIcon(chosenSkin)}
                  subtitle={player.completedAt ? 'ДУУССАН' : player.ready ? 'БЭЛЭН' : 'ХҮЛЭЭЖ БАЙНА'}/>;
              })}
            </div>}
            {snapshot.phase === 'waiting' && <div className="ready-area">
              <p>Бүх тоглогч бэлэн болмогц 3 секундын дараа уралдаан эхэлнэ.</p>
              <button className="primary-button" onClick={ready} disabled={myPlayer?.ready || snapshot.players.length < 2}>{myPlayer?.ready ? '✓ БЭЛЭН' : snapshot.players.length < 2 ? 'НАЙЗАА ХҮЛЭЭЖ БАЙНА' : '✓ БЭЛЭН →'}</button>
            </div>}
            {(snapshot.phase === 'countdown' || snapshot.phase === 'racing' || snapshot.phase === 'finished') &&
              <div className="online-type">
                <div className="typing-label"><span>{snapshot.phase === 'countdown' ? 'БЭЛДЭЭРЭЙ…' : 'ДООРХ ТЕКСТИЙГ БИЧНЭ ҮҮ'}</span><span>{myPlayer?.progress || 0} / {characters(snapshot.prompt.text).length}</span></div>
                <PhraseView prompt={snapshot.prompt} typed="" progress={myPlayer?.progress || 0}/>
                <input ref={onlineInputRef} className="typing-input" aria-label="Онлайн уралдааны бичих хэсэг"
                  data-race-enabled={onlineCanType}
                  placeholder={onlineCanType ? 'Энд бичнэ үү...' : 'Энд дарж keyboard-оо бэлдээрэй'}
                  readOnly={snapshot.phase === 'finished'} onPaste={e => e.preventDefault()} onChange={submitOnlineInput}
                  onCompositionStart={() => { onlineCompositionBeforeStart.current = !onlineCanType; }}
                  onCompositionEnd={e => { const element = e.currentTarget; const value = characters(element.value); element.value = ''; if (onlineCanType && !onlineCompositionBeforeStart.current) for (const key of value.slice(0,8)) socketRef.current?.send(JSON.stringify({ type: 'key', key })); onlineCompositionBeforeStart.current = false; }}/>
              </div>}
            {(snapshot.phase === 'racing' || snapshot.phase === 'finished') && <div className="race-stats">
              <div><strong>{onlineWpm}</strong><span>WPM</span></div>
              <div><strong>{onlineAccuracy}<small>%</small></strong><span>Нарийвчлал</span></div>
              <div><strong>{myPlayer ? progressPercent(myPlayer.progress, snapshot.prompt.text) : 0}<small>%</small></strong><span>Замын явц</span></div>
            </div>}
            {snapshot.phase === 'finished' && <div className="finish-banner" role="status"><strong>Уралдаан дууслаа{raceResult !== null ? ' · ' + raceResult + ' WPM' : ''}</strong>
              <button className="primary-button" onClick={() => socketRef.current?.send(JSON.stringify({ type: 'rematch', matchId: snapshot.matchId }))}>↻ ДАХИН ТОГЛОХ</button>
              <button className="secondary-button" onClick={() => { disconnect(); navigate('multiplayer'); }}>ШИНЭ ӨРӨӨ →</button></div>}
            <button className="leave-link" onClick={() => { disconnect(); navigate('multiplayer'); }}>← Өрөөнөөс гарах</button>
          </div>}
          {!!error && <p className="error-note" role="alert">{error}</p>}
        </section>

        <p className="help-note">Зочны уралдаан. Албан ёсны рейтинг, шагнал болон үр дүнгийн хадгалалт идэвхгүй.</p>
      </>}
      <footer>© TypeRacer Mongolia <span>·</span> PLAY FAIR. TYPE FAST. <span>·</span> BETA</footer>
    </main>
  </div>;
}
