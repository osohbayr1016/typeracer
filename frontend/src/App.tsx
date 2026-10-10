import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  accuracyPercent, characters, choosePrompt, normalizeText, progressPercent,
  PROMPTS, wordsPerMinute, type Language, type Prompt, type RoomSnapshot
} from '@typeracer/shared';

type Mode = 'practice' | 'multiplayer';
type Skin = 'mint' | 'sunset' | 'purple';
const SKINS: Record<Skin, { color: string; label: string; icon: string }> = {
  mint: { color: '#54e7c9', label: 'Mint Racer', icon: '🏎️' },
  sunset: { color: '#ffae58', label: 'Sunset GT', icon: '🚘' },
  purple: { color: '#bb96ff', label: 'Night Rider', icon: '🚗' }
};
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const roomCodePattern = /^[A-F0-9]{8}$/;
function storedNumber(key: string): number {
  try { return Math.max(0, Number(localStorage.getItem(key)) || 0); }
  catch { return 0; }
}
function storedSkin(): Skin {
  try {
    const value = localStorage.getItem('racer.skin');
    return value && value in SKINS ? value as Skin : 'mint';
  } catch { return 'mint'; }
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
function Lane({ name, progress, color, icon, subtitle, isYou }: {
  name: string; progress: number; color: string; icon: string; subtitle: string; isYou?: boolean
}) {
  return <div className={'lane ' + (isYou ? 'you' : '')}>
    <div className="lane-header"><span className="lane-name">{name}{isYou ? ' · YOU' : ''}</span><span className="lane-detail">{subtitle}</span></div>
    <div className="lane-road">
      <div className="lane-progress" style={{ width: progress + '%', background: color }} />
      <span className="lane-car" style={{ left: Math.min(92, Math.max(1, progress)) + '%', filter: 'drop-shadow(0 0 8px ' + color + '66)' }} aria-hidden="true">{icon}</span>
      <span className="finish-flag" aria-hidden="true">▦</span>
    </div>
  </div>;
}

export function App() {
  const [mode, setMode] = useState<Mode>('practice');
  const [language, setLanguage] = useState<Language>('mn');
  const [prompt, setPrompt] = useState<Prompt>(() => choosePrompt('mn', 0));
  const [typed, setTyped] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState(() => storedNumber('racer.best'));
  const [xp, setXp] = useState(() => storedNumber('racer.xp'));
  const [skin, setSkin] = useState<Skin>(storedSkin);
  const inputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState('Зочин');
  const [joinCode, setJoinCode] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [myId, setMyId] = useState('');
  const [raceResult, setRaceResult] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 125);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);
  useEffect(() => () => socketRef.current?.close(), []);
  const target = useMemo(() => characters(prompt.text), [prompt]);
  const entered = useMemo(() => characters(typed), [typed]);
  const correct = entered.filter((letter, index) => letter === target[index]).length;
  const elapsed = startedAt === null ? 0 : (finishedAt ?? now) - startedAt;
  const wpm = wordsPerMinute(correct, elapsed);
  const accuracy = accuracyPercent(correct, entered.length);
  const progress = progressPercent(correct, prompt.text);
  const myPlayer = snapshot?.players.find(p => p.id === myId);
  function resetPractice(nextLanguage = language) {
    const pool = PROMPTS[nextLanguage].filter(item => item.id !== prompt.id);
    const next = pool[Math.floor(Math.random() * pool.length)] || choosePrompt(nextLanguage);
    setLanguage(nextLanguage);
    setPrompt(next);
    setTyped(''); setStartedAt(null); setFinishedAt(null); setNow(Date.now());
    window.setTimeout(() => inputRef.current?.focus(), 10);
  }
  function updateTyping(event: ChangeEvent<HTMLInputElement>) {
    if (finishedAt !== null) return;
    const value = normalizeText(event.target.value);
    if (characters(value).length > target.length) return;
    if (startedAt === null && value.length > 0) setStartedAt(Date.now());
    setTyped(value);
    if (value === prompt.text) {
      const end = Date.now();
      setFinishedAt(end);
      const score = wordsPerMinute(target.length, Math.max(1, end - (startedAt ?? end)));
      if (score > best) {
        setBest(score);
        try { localStorage.setItem('racer.best', String(score)); } catch { /* storage unavailable */ }
      }
      const points = Math.max(10, Math.min(100, score));
      setXp(prev => {
        try { localStorage.setItem('racer.xp', String(prev + points)); } catch { /* storage unavailable */ }
        return prev + points;
      });
    }
  }
  function updateSkin(value: Skin) {
    setSkin(value);
    try { localStorage.setItem('racer.skin', value); } catch { /* storage unavailable */ }
  }
  function disconnect() {
    socketRef.current?.close(); socketRef.current = null;
    setStatus('disconnected'); setSnapshot(null); setCode(''); setMyId(''); setRaceResult(null);
  }
  function connectRoom(roomCode: string) {
    const clean = roomCode.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) { setError('Өрөөний код 8 тэмдэгттэй байх ёстой.'); return; }
    disconnect(); setCode(clean); setError(''); setStatus('connecting');
    const base = API_BASE || window.location.origin;
    const url = base.replace(/^http/, 'ws') + '/api/rooms/' + clean + '/ws?name=' + encodeURIComponent(nickname);
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch { setError('Сервертэй холбогдож чадсангүй.'); setStatus('disconnected'); return; }
    socketRef.current = socket;
    socket.onopen = () => { setStatus('connected'); setError(''); };
    socket.onmessage = event => {
      try {
        const value = JSON.parse(event.data) as RoomSnapshot | { type: 'welcome'; id: string } | { type: 'result'; wpm: number };
        if (value.type === 'welcome') setMyId(value.id);
        if (value.type === 'state') setSnapshot(value);
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
    if (snapshot?.phase !== 'racing' || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      element.value = ''; return;
    }
    if ((event.nativeEvent as InputEvent).isComposing) return;
    const value = characters(element.value);
    element.value = '';
    for (const key of value.slice(0, 8)) socketRef.current.send(JSON.stringify({ type: 'key', key }));
  }
  function ready() { socketRef.current?.send(JSON.stringify({ type: 'ready' })); }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); } catch { setError('Кодыг гараар хуулна уу.'); }
  }

  return <div className="app-shell" style={{ '--accent': SKINS[skin].color } as CSSProperties}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">↗</div><div><strong>TYPE<span>RACER</span></strong><small>MONGOLIA · BETA</small></div></div>
      <div className="nav-label">PLAY</div>
      <button className={'nav-item ' + (mode === 'practice' ? 'selected' : '')} onClick={() => setMode('practice')}><span>⌨</span> Бичих дасгал <i>01</i></button>
      <button className={'nav-item ' + (mode === 'multiplayer' ? 'selected' : '')} onClick={() => setMode('multiplayer')}><span>⚑</span> Найзуудтай уралдах <i>02</i></button>
      <div className="nav-label secondary">COMING NEXT</div>
      <div className="nav-item disabled"><span>◈</span> Ranked / Улсын аварга <em>SOON</em></div>
      <div className="nav-item disabled"><span>♛</span> Тэмцээн <em>SOON</em></div>
      <div className="sidebar-bottom"><div className="online-indicator"><b/> FREE PRACTICE AVAILABLE</div><p>МОНГОЛ КИРИЛЛ · Ө / Ү</p></div>
    </aside>
    <div className="content">
      <header className="topbar"><div className="topbar-left"><span className="topbar-dot"/> PLAYGROUND <span className="slash">/</span> <span className="active-page">{mode === 'practice' ? 'SOLO PRACTICE' : 'MULTIPLAYER'}</span></div><div className="topbar-right"><span className="level-label">PRACTICE XP</span><strong>✦ {xp.toLocaleString()}</strong><span className="guest-avatar">G</span></div></header>
      <main className="main">
        <div className="intro"><div className="eyebrow">⚡ БИЧИХ ХУРДАА НЭМЭГДҮҮЛ</div><h1>Үсэг бүр <span>ялалт руу.</span></h1><p>Монгол хэлээр бичих хурдаа шалга. Найзуудтайгаа зам дээр өрсөлд.</p></div>
        <div className="stats-grid">
          <div className="stat-card"><span>⚡ ОДООГИЙН ХУРД</span><div><strong>{mode === 'practice' ? wpm : (myPlayer && snapshot?.startAt ? wordsPerMinute(myPlayer.progress, Math.max(1, (myPlayer.completedAt || now) - snapshot.startAt)) : 0)}</strong> <small>WPM</small></div></div>
          <div className="stat-card"><span>◎ НАРИЙВЧЛАЛ</span><div><strong>{mode === 'practice' ? accuracy : (myPlayer ? accuracyPercent(myPlayer.progress, myPlayer.strokes) : 100)}</strong> <small>%</small></div></div>
          <div className="stat-card"><span>◷ ХУВИЙН РЕКОРД</span><div><strong>{best}</strong> <small>WPM</small></div></div>
          <div className="stat-card"><span>◈ ТҮВШИН</span><div><strong>{Math.floor(xp / 250) + 1}</strong> <small>LOCAL</small></div></div>
        </div>
        {mode === 'practice' ? <>
          <section className="game-panel">
            <div className="panel-head"><div><span className="live-pill"><b/> SOLO RACE</span><h2>Хурдны зам</h2></div><div className="panel-actions"><div className="segmented"><button className={language === 'mn' ? 'active' : ''} onClick={() => resetPractice('mn')}>МОН</button><button className={language === 'en' ? 'active' : ''} onClick={() => resetPractice('en')}>ENG</button></div><button className="text-button" onClick={() => resetPractice()}>↻ Шинэ текст</button></div></div>
            <div className="track-wrap"><div className="track-top"><span>START / 00</span><span>FINISH / 100%</span></div><Lane name="YOU · PRACTICE" progress={progress} color={SKINS[skin].color} icon={SKINS[skin].icon} subtitle={progress + '%'} isYou/></div>
            <div className="typing-area" onClick={() => inputRef.current?.focus()}>
              <div className="typing-label"><span>TYPE THE TEXT BELOW</span><span>{correct} / {target.length} CHARACTERS</span></div>
              <PhraseView prompt={prompt} typed={typed}/>
              <input ref={inputRef} autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} value={typed} onPaste={e => e.preventDefault()} onChange={updateTyping} aria-label="Энд бичиж эхлээрэй" className="typing-input" placeholder={finishedAt ? 'Дараагийн текстээ сонгоно уу' : 'Энд бичиж эхлээрэй...'} disabled={finishedAt !== null}/>
              {finishedAt !== null && <div className="finish-banner"><span>🏁 Баяр хүргэе! {wpm} WPM · {accuracy}%</span><button className="primary-button" onClick={() => resetPractice()}>ДАХИН УРАЛДАХ →</button></div>}
            </div>
            <div className="game-foot"><span>⌨ Ө, Ү үсгийг зөв ашиглаарай. Алдааг Backspace-аар засна.</span><span>{elapsed > 0 ? (elapsed / 1000).toFixed(1) + 's' : 'READY'}</span></div>
          </section>
          <div className="below-grid">
            <section className="mini-panel"><div className="mini-title">ГАРАА СОНГО <span>FREE COSMETICS</span></div><div className="skin-row">{(Object.keys(SKINS) as Skin[]).map(key => <button key={key} aria-pressed={skin === key} className={'skin-card ' + (skin === key ? 'chosen' : '')} onClick={() => updateSkin(key)}><span className="skin-icon" style={{ background: SKINS[key].color + '22' }}>{SKINS[key].icon}</span><strong>{SKINS[key].label}</strong><small>{skin === key ? '✓ SELECTED' : 'SELECT'}</small></button>)}</div></section>
            <section className="mini-panel lesson"><div className="mini-title">ӨНӨӨДРИЙН ДАСГАЛ <span>TIP</span></div><div className="lesson-row"><div className="lesson-icon">Ө</div><div><strong>Монгол гарын байрлал</strong><p>Ө, Ү үсгийг тогтвортой дарах дасгал хий. Хурдаас өмнө зөв бичилт чухал.</p></div></div></section>
          </div>
        </> : <>
          <section className="game-panel multiplayer-panel">
            <div className="panel-head"><div><span className="live-pill"><b/> LIVE GUEST ROOM</span><h2>Найзуудтайгаа уралд</h2></div><span className="private-note">UNRANKED · 2–6 RACERS</span></div>
            {status === 'disconnected' && <div className="lobby-start">
              <div className="lobby-illustration">🏎️ <span>⚡</span> 🚗</div>
              <p>Өрөө үүсгээд найздаа кодоо явуул. Одоогоор зөвхөн зочны уралдаан ажиллана.</p>
              <label className="field-label" htmlFor="nickname">ТОГЛОГЧИЙН НЭР</label><input id="nickname" className="field" value={nickname} maxLength={20} onChange={e => setNickname(e.target.value)} aria-label="Тоглогчийн нэр"/>
              <button className="primary-button full" onClick={() => void createRoom()}>+ ШИНЭ ӨРӨӨ ҮҮСГЭХ</button>
              <div className="divider-text">ЭСВЭЛ КОДООР НЭВТРЭХ</div>
              <div className="join-row"><input className="field" maxLength={8} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))} placeholder="8 ОРОНТОЙ КОД" aria-label="Өрөөний код"/><button className="secondary-button" onClick={() => connectRoom(joinCode)}>НЭВТРЭХ →</button></div>
            </div>}
            {status === 'connecting' && <p className="connection-note">Сервертэй холбогдож байна...</p>}
            {status === 'connected' && snapshot && <div className="room-active">
              <div className="room-info"><div><small>ROOM CODE</small><strong>{code}</strong></div><button className="secondary-button" onClick={() => void copyCode()}>⧉ КОД ХУУЛАХ</button></div>
              <div className="room-meta">{snapshot.players.length} / 6 ТОГЛОГЧ · {snapshot.phase === 'waiting' ? 'БЭЛЭН БАЙДЛЫГ ХҮЛЭЭЖ БАЙНА' : snapshot.phase.toUpperCase()}</div>
              <div className="multiplayer-track">{snapshot.players.map((player, index) => <Lane key={player.id} name={player.name} isYou={player.id === myId} progress={progressPercent(player.progress, snapshot.prompt.text)} color={player.id === myId ? SKINS[skin].color : ['#ffae58', '#a698ff', '#70baff'][index % 3]} icon={player.id === myId ? SKINS[skin].icon : '🏎️'} subtitle={player.completedAt ? 'FINISHED' : player.ready ? 'READY' : 'WAITING'}/>)}</div>
              {snapshot.phase === 'waiting' && <div className="ready-area"><p>Хоёр ба түүнээс олон тоглогч бэлэн болбол 3 секундийн дараа уралдаан эхэлнэ.</p><button className="primary-button" onClick={ready} disabled={myPlayer?.ready}>{myPlayer?.ready ? '✓ БЭЛЭН' : 'БЭЛЭН БОЛОХ →'}</button></div>}
              {(snapshot.phase === 'countdown' || snapshot.phase === 'racing' || snapshot.phase === 'finished') && <div className="online-type"><div className="typing-label"><span>{snapshot.phase === 'countdown' ? 'БЭЛДЭЭРЭЙ...' : 'ТЕКСТЭЭ БИЧЭЭРЭЙ'}</span><span>{myPlayer?.progress || 0} / {characters(snapshot.prompt.text).length}</span></div><PhraseView prompt={snapshot.prompt} typed="" progress={myPlayer?.progress || 0}/><input className="typing-input" aria-label="Онлайн уралдааны бичих хэсэг" placeholder={snapshot.phase === 'racing' ? 'Энд бичнэ үү...' : 'Уралдаан эхлэхийг хүлээнэ үү'} readOnly={snapshot.phase !== 'racing'} onPaste={e => e.preventDefault()} onChange={submitOnlineInput} onCompositionEnd={e => { const element = e.currentTarget; const value = characters(element.value); element.value = ''; if (snapshot.phase === 'racing') for (const key of value.slice(0,8)) socketRef.current?.send(JSON.stringify({ type: 'key', key })); }}/></div>}
              {snapshot.phase === 'finished' && <div className="finish-banner"><span>🏁 Уралдаан дууслаа{raceResult !== null ? ' · ' + raceResult + ' WPM' : ''}</span><button className="secondary-button" onClick={disconnect}>ӨРӨӨНӨӨС ГАРАХ</button></div>}
              <button className="leave-link" onClick={disconnect}>✕ ӨРӨӨНӨӨС ГАРАХ</button>
            </div>}
            {status === 'disconnected' && !!code && <div className="connection-note">Холболт тасарсан. Дахин нэвтэрнэ үү.</div>}
            {!!error && <p className="error-note" role="alert">{error}</p>}
            <div className="game-foot"><span>🔒 Албан ёсны рейтинг, шагнал, төлбөр идэвхгүй. Зочны уралдааны үр дүн хадгалагдахгүй.</span></div>
          </section>
          <section className="safety-panel"><b>FAIR PLAY FIRST</b><p>Харилцагчийн илгээсэн WPM-ийг сервер шууд хүлээн авдаггүй. Онлайн тоглолтын зөв товч бүрийг сервер шалгана. Гэхдээ энэ нь бот, автоматжуулалтыг бүрэн зогсоохгүй тул ranked тэмцээн нээгдээгүй.</p></section>
        </>}
        <footer><span>© 2026 TYPERACER MONGOLIA · OPEN BETA</span><span>МОНГОЛ КИРИЛЛ БИЧГИЙН СОЁЛЫГ ХӨГЖҮҮЛЬЕ</span></footer>
      </main>
    </div>
  </div>;
}
