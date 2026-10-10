import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  accuracyPercent, characters, choosePrompt, normalizeText, progressPercent,
  PROMPTS, wordsPerMinute, type Language, type Prompt, type RoomSnapshot
} from '@typeracer/shared';

type Mode = 'practice' | 'multiplayer';
type Skin = 'mint' | 'sunset' | 'purple';
const SKINS: Record<Skin, { color: string; label: string; icon: string }> = {
  mint: { color: '#3679e8', label: 'Blue Sprint', icon: '/cars/blue-sprint.svg' },
  sunset: { color: '#ec6b55', label: 'Coral GT', icon: '/cars/coral-gt.svg' },
  purple: { color: '#66788f', label: 'Graphite R', icon: '/cars/graphite-r.svg' }
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
      <img className="lane-car" style={{ left: Math.min(86, Math.max(0, progress)) + '%' }} src={icon} alt="" aria-hidden="true" draggable={false}/>
      <span className="finish-flag" aria-hidden="true">▦</span>
    </div>
  </div>;
}

export function App() {
  const [mode, setMode] = useState<Mode>(() => new URLSearchParams(window.location.search).has('room') ? 'multiplayer' : 'practice');
  const [language, setLanguage] = useState<Language>('mn');
  const [prompt, setPrompt] = useState<Prompt>(() => choosePrompt('mn', 0));
  const [typed, setTyped] = useState('');
  const [strokes, setStrokes] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState(() => storedNumber('racer.best'));
  const [xp, setXp] = useState(() => storedNumber('racer.xp'));
  const [skin, setSkin] = useState<Skin>(storedSkin);
  const inputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState('Зочин');
  const [joinCode, setJoinCode] = useState(() => (new URLSearchParams(window.location.search).get('room') || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 8));
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
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
  const myPlayer = snapshot?.players.find(p => p.id === myId);
  const onlineWpm = myPlayer && snapshot?.startAt
    ? wordsPerMinute(myPlayer.progress, Math.max(1, (myPlayer.completedAt ?? now) - snapshot.startAt)) : 0;
  const onlineAccuracy = myPlayer ? accuracyPercent(Math.max(0, myPlayer.strokes - myPlayer.mistakes), myPlayer.strokes) : 100;
  useEffect(() => {
    if (mode === 'multiplayer' && snapshot?.phase === 'racing') onlineInputRef.current?.focus();
  }, [mode, snapshot?.phase]);
  useEffect(() => {
    if (mode !== 'practice' || finishedAt === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) resetPractice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, finishedAt, language, prompt.id]);
  function resetPractice(nextLanguage = language) {
    const pool = PROMPTS[nextLanguage].filter(item => item.id !== prompt.id);
    const next = pool[Math.floor(Math.random() * pool.length)] || choosePrompt(nextLanguage);
    setLanguage(nextLanguage);
    setPrompt(next);
    setTyped(''); setStrokes(0); setMistakes(0); setStartedAt(null); setFinishedAt(null); setNow(Date.now());
    window.setTimeout(() => inputRef.current?.focus(), 10);
  }
  function updateTyping(event: ChangeEvent<HTMLInputElement>) {
    if (finishedAt !== null) return;
    const value = normalizeText(event.target.value);
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
    try { await navigator.clipboard.writeText(window.location.origin + '/?room=' + code); } catch { setError('Урилгын холбоосыг гараар хуулна уу.'); }
  }

  return <div className="app-shell" style={{ '--accent': SKINS[skin].color } as CSSProperties}>
    <header className="topbar">
      <div className="shell header-layout">
        <a className="brand" href="/" aria-label="TypeRacer Mongolia нүүр">
          <span className="brand-mark">↗</span>
          <span className="brand-name">TYPE<span>RACER</span><small>MONGOLIA</small></span>
        </a>
        <nav className="main-nav" aria-label="Тоглох горим">
          <button className={'nav-item ' + (mode === 'practice' ? 'selected' : '')}
            aria-current={mode === 'practice' ? 'page' : undefined}
            onClick={() => { if (mode === 'multiplayer') disconnect(); setMode('practice'); }}>
            Бичих дасгал
          </button>
          <button className={'nav-item ' + (mode === 'multiplayer' ? 'selected' : '')}
            aria-current={mode === 'multiplayer' ? 'page' : undefined}
            onClick={() => setMode('multiplayer')}>
            Найзуудтай уралдах
          </button>
        </nav>
        <div className="header-right">
          <span className="beta-label">БЕТА</span>
          {mode === 'practice'
            ? <button className="primary-button header-cta" onClick={() => inputRef.current?.focus()}>УРАЛДАХ →</button>
            : <button className="primary-button header-cta" onClick={() => { disconnect(); setMode('practice'); window.setTimeout(() => inputRef.current?.focus(), 20); }}>ДАСГАЛ ХИЙХ →</button>}
        </div>
      </div>
    </header>

    <main className="shell main">
      <div className="page-heading">
        <div className="page-heading-copy">
          <div className="eyebrow">{mode === 'practice' ? 'БИЧИХ ДАСГАЛ' : 'НАЙЗУУДТАЙ УРАЛДАХ'} <span className="eyebrow-sep">/</span> MONGOLIA</div>
          <h1>Үсэг бүр <span>ялалт руу.</span></h1>
          <p>{mode === 'practice'
            ? 'Өгүүлбэрийг зөв бич. Машинаа барианд хүргэ. Рекордоо ахиул.'
            : 'Нэг өрөөнд цуглараад Монгол хэлээр хэн хурдан бичихээ сориорой.'}</p>
        </div>
        {mode === 'practice' && <div className="heading-pb" aria-label={'Хувийн дээд хурд ' + best + ' WPM'}>
          <span>ХУВИЙН ДЭЭД</span><strong>{best}</strong><small>WPM</small>
        </div>}
      </div>

      {mode === 'practice' ? <>
        <section className="race-panel" aria-label="Ганцаарчилсан бичих уралдаан">
          <div className="race-panel-head">
            <div className="race-title"><span className="race-indicator"/> <h2>Бичих уралдаан</h2><span className="race-chip">SOLO RACE</span></div>
            <div className="panel-actions">
              <div className="segmented" role="group" aria-label="Хэл сонгох">
                <button className={language === 'mn' ? 'active' : ''} aria-pressed={language === 'mn'} onClick={() => resetPractice('mn')}>Монгол</button>
                <button className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => resetPractice('en')}>English</button>
              </div>
              <button className="text-button" onClick={() => resetPractice()} aria-label="Шинэ текст">↻ Шинэ текст</button>
            </div>
          </div>
          <div className="track-wrap">
            <div className="track-meta"><span>START</span><span className="track-heading">THE TRACK</span><span>FINISH</span></div>
            <Lane name="ТА" progress={progress} color={SKINS[skin].color} icon={SKINS[skin].icon} subtitle={progress + '%'} isYou />
          </div>
          <div className="typing-area" onClick={() => inputRef.current?.focus()}>
            <div className="typing-label"><span>ДООРХ ТЕКСТИЙГ БИЧНЭ ҮҮ</span><span>{correct} / {target.length} ҮСЭГ</span></div>
            <PhraseView prompt={prompt} typed={typed}/>
            <input ref={inputRef} autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off"
              spellCheck={false} value={typed} onPaste={e => e.preventDefault()} onChange={updateTyping}
              aria-label="Энд бичиж эхлээрэй" className="typing-input"
              placeholder={finishedAt !== null ? 'Барианд орлоо!' : 'Энд бичиж эхлээрэй...'} disabled={finishedAt !== null}/>
            {finishedAt !== null && <div className="finish-banner" role="status"><strong>Барианд орлоо! {wpm} WPM · {accuracy}%</strong><button className="primary-button" onClick={() => resetPractice()}>ДАХИН УРАЛДАХ →</button></div>}
          </div>
          <div className="race-stats" aria-label="Уралдааны үзүүлэлт">
            <div><strong>{wpm}</strong><span>WPM</span></div>
            <div><strong>{accuracy}<small>%</small></strong><span>Нарийвчлал</span></div>
            <div><strong>{progress}<small>%</small></strong><span>Замын явц</span></div>
            <div><strong>{elapsed > 0 ? (elapsed / 1000).toFixed(1) : '0.0'}<small>s</small></strong><span>Хугацаа</span></div>
          </div>
        </section>
        <p className="help-note">Алдаа гарвал Backspace дарж засна. Монгол хэлний Ө, Ү үсгийг зөв ашиглаарай.</p>

        <section className="garage-panel" aria-label="Машинаа сонгох">
          <div className="garage-heading">
            <div><h2>Миний гараж</h2><p>Үнэгүй машинууд — тоглолтын хурданд нөлөөлөхгүй.</p></div>
            <span className="garage-count">3 машин</span>
          </div>
          <div className="skin-row">
            {(Object.keys(SKINS) as Skin[]).map(key => <button key={key} aria-pressed={skin === key}
              className={'skin-card ' + (skin === key ? 'chosen' : '')} onClick={() => updateSkin(key)}>
              <img src={SKINS[key].icon} alt="" draggable={false}/>
              <span>{SKINS[key].label}</span>
              <small>{skin === key ? '✓ Сонгосон' : 'Сонгох'}</small>
            </button>)}
          </div>
        </section>
      </> : <>
        <section className="race-panel multiplayer-panel" aria-label="Найзуудтай уралдах">
          <div className="race-panel-head">
            <div className="race-title"><span className="race-indicator"/><h2>Найзуудтайгаа уралд</h2><span className="race-chip">LIVE · 2–6</span></div>
            <span className="unranked-label">Зочны өрөө</span>
          </div>

          {status === 'disconnected' && <div className="lobby-start">
            <div className="lobby-intro"><h3>Өрөө үүсгэх</h3><p>Нэрээ оруулаад өрөө нээнэ. Найздаа урилгын холбоосоо явуулж уралдаарай.</p></div>
            <label className="field-label" htmlFor="nickname">ТОГЛОГЧИЙН НЭР</label>
            <input id="nickname" className="field" value={nickname} maxLength={20}
              onChange={e => setNickname(e.target.value)} aria-label="Тоглогчийн нэр"/>
            <button className="primary-button full" onClick={() => void createRoom()}>+ ШИНЭ ӨРӨӨ ҮҮСГЭХ</button>
            <div className="divider-text">ЭСВЭЛ НЭГДЭХ</div>
            <label className="field-label" htmlFor="join-code">ӨРӨӨНИЙ КОД</label>
            <div className="join-row"><input id="join-code" className="field" maxLength={8} value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))}
              placeholder="Жишээ: A3BF29C1" aria-label="Өрөөний код"/>
              <button className="secondary-button" onClick={() => connectRoom(joinCode)}>НЭВТРЭХ →</button>
            </div>
          </div>}
          {status === 'connecting' && <p className="connection-note">Өрөөнд холбогдож байна…</p>}
          {status === 'connected' && snapshot && <div className="room-active">
            <div className="room-info"><div><small>ӨРӨӨНИЙ КОД</small><strong>{code}</strong></div>
              <button className="secondary-button" onClick={() => void copyCode()}>↗ Холбоос хуулах</button></div>
            <div className="room-meta" aria-live="polite">{snapshot.players.length} / 6 тоглогч · {snapshot.phase === 'waiting' ? 'Бэлэн болохыг хүлээж байна' : snapshot.phase === 'countdown' ? 'Уралдаан эхлэх гэж байна' : snapshot.phase === 'racing' ? 'Уралдаж байна' : 'Дууссан'}</div>
            <div className="multiplayer-track">
              {snapshot.players.map((player, index) => <Lane key={player.id} name={player.name} isYou={player.id === myId}
                progress={progressPercent(player.progress, snapshot.prompt.text)}
                color={player.id === myId ? SKINS[skin].color : ['#ec6b55', '#66788f', '#3679e8'][index % 3]}
                icon={player.id === myId ? SKINS[skin].icon : ['/cars/coral-gt.svg', '/cars/graphite-r.svg', '/cars/blue-sprint.svg'][index % 3]}
                subtitle={player.completedAt ? 'FINISHED' : player.ready ? 'READY' : 'WAITING'}/>)}
            </div>
            {snapshot.phase === 'waiting' && <div className="ready-area">
              <p>Бүх тоглогч бэлэн болмогц 3 секундын дараа уралдаан эхэлнэ.</p>
              <button className="primary-button" onClick={ready} disabled={myPlayer?.ready}>{myPlayer?.ready ? '✓ БЭЛЭН' : 'БЭЛЭН БОЛОХ →'}</button>
            </div>}
            {(snapshot.phase === 'countdown' || snapshot.phase === 'racing' || snapshot.phase === 'finished') &&
              <div className="online-type">
                <div className="typing-label"><span>{snapshot.phase === 'countdown' ? 'БЭЛДЭЭРЭЙ…' : 'ДООРХ ТЕКСТИЙГ БИЧНЭ ҮҮ'}</span><span>{myPlayer?.progress || 0} / {characters(snapshot.prompt.text).length}</span></div>
                <PhraseView prompt={snapshot.prompt} typed="" progress={myPlayer?.progress || 0}/>
                <input ref={onlineInputRef} className="typing-input" aria-label="Онлайн уралдааны бичих хэсэг"
                  placeholder={snapshot.phase === 'racing' ? 'Энд бичнэ үү...' : 'Эхлэхийг хүлээнэ үү'}
                  readOnly={snapshot.phase !== 'racing'} onPaste={e => e.preventDefault()} onChange={submitOnlineInput}
                  onCompositionEnd={e => { const element = e.currentTarget; const value = characters(element.value); element.value = ''; if (snapshot.phase === 'racing') for (const key of value.slice(0,8)) socketRef.current?.send(JSON.stringify({ type: 'key', key })); }}/>
              </div>}
            {(snapshot.phase === 'racing' || snapshot.phase === 'finished') && <div className="race-stats">
              <div><strong>{onlineWpm}</strong><span>WPM</span></div>
              <div><strong>{onlineAccuracy}<small>%</small></strong><span>Нарийвчлал</span></div>
              <div><strong>{myPlayer ? progressPercent(myPlayer.progress, snapshot.prompt.text) : 0}<small>%</small></strong><span>Замын явц</span></div>
            </div>}
            {snapshot.phase === 'finished' && <div className="finish-banner" role="status"><strong>Уралдаан дууслаа{raceResult !== null ? ' · ' + raceResult + ' WPM' : ''}</strong><button className="primary-button" onClick={disconnect}>ДАХИН УРАЛДАХ</button></div>}
            <button className="leave-link" onClick={disconnect}>← Өрөөнөөс гарах</button>
          </div>}
          {!!error && <p className="error-note" role="alert">{error}</p>}
        </section>
        <p className="help-note">Зочны уралдаан. Албан ёсны рейтинг, шагнал болон үр дүнгийн хадгалалт идэвхгүй.</p>
      </>}
      <footer>TypeRacer Mongolia · Beta</footer>
    </main>
  </div>;
}
