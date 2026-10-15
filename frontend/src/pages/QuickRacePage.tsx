import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  progressPercent, type RoomSnapshot, type Racer
} from '@typeracer/shared';
import { CARS, raceCarIcon, type Skin } from './cars';
import { type Profile } from '../progression';
import { QuickTypingPanel } from './QuickTypingPanel';
import { sendRaceKey } from './typingSync';
import { raceCanType } from './raceStartSignal';
import { readRaceClock, useRaceStart, type ServerClock } from './useRaceStart';
import { type QuickRaceOutcome, type QuickResult } from './quickResultsModel';
import './QuickRacePage.css';

export type { QuickResult } from './quickResultsModel';
type Props = {
  car: Skin; profile: Profile; nickname: string;
  onBack: () => void; onGarage: () => void; onReward: (result: QuickResult) => void;
  onFinish: (outcome: QuickRaceOutcome) => void;
};
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const RESUME_KEY = 'typeracer.quick.resume.v1';
const BOT_CARS: Skin[] = ['mint','steppe','thunder'];

function carOf(player: Racer, index: number): Skin {
  return player.car && player.car in CARS ? player.car as Skin : BOT_CARS[index % BOT_CARS.length];
}
const QuickLane = memo(function QuickLane({ name, mine, rank, done, bot, connected, car }: {
  name: string; mine: boolean; rank: number; done: number; bot: boolean; connected: boolean; car: Skin;
}) {
  return <div className={'quick-lane'+(mine?' me':'')}>
    <div className="quick-lane-meta">
      <span className="quick-lane-order">{rank}</span>
      <div><strong>{name}{mine ? ' · ТА' : ''}</strong>
        <small>{bot ? 'БОТ' : !connected ? 'ХОЛБОЛТ ТАСАРСАН' : 'ТОГЛОГЧ'}</small></div>
      <b>{done}%</b>
    </div>
    <div className="quick-road">
      <span className="quick-road-progress" style={{ transform: `scaleX(${done / 100})` }}/>
      <span className="quick-car-position" style={{ transform: `translate3d(${done}%,0,0)` }}>
        <img src={raceCarIcon(car)} alt="" draggable={false} decoding="async"
          style={{ transform: `translate3d(-${done}%,0,0)` }}/>
      </span>
      <span className="quick-flag" aria-hidden="true"/>
    </div>
  </div>;
});
export function QuickRacePage({ car, profile, nickname, onBack, onGarage, onReward, onFinish }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [myId, setMyId] = useState('');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [clock, setClock] = useState<ServerClock | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const rewardRef = useRef(onReward);
  const finishRef = useRef(onFinish);
  const latestSnapshot = useRef<RoomSnapshot | null>(null);
  const latestMyId = useRef('');
  const awardedMatches = useRef(new Set<string>());
  rewardRef.current = onReward;
  finishRef.current = onFinish;

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setKeyboardOpen(!!viewport && viewport.height < window.innerHeight - 120);
    viewport?.addEventListener('resize', update);
    return () => viewport?.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    let disposed = false;
    let receivedResult = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const accountTimeout = setTimeout(() => controller.abort(), 3000);
    setConnection('connecting'); setError(''); setResult(null); setSnapshot(null); setMyId('');
    latestSnapshot.current = null;
    setClock(null);
    const base = API_BASE || window.location.origin;
    const params = new URLSearchParams({ name: nickname, car, trail: profile.trail,
      sticker: profile.sticker, title: profile.title });
    // Per-tab bearer token: reconnect to the SAME match inside the Durable Object.
    // Never persist the token in the player profile or send it to opponents.
    try {
      const resume = window.sessionStorage.getItem(RESUME_KEY);
      if (resume) params.set('resume', resume);
    } catch { /* private browsing may disable session storage */ }
    const url = base.replace(/^http/, 'ws') + '/api/quickplay/ws?' + params;
    let socket: WebSocket | null = null;
    // Issue an HttpOnly same-origin guest cookie BEFORE WebSocket upgrade.
    // The browser cannot claim points itself; the DO writes finished scores.
    void (async () => {
      try {
        await fetch(base + '/api/account', { credentials:'include', signal: controller.signal });
      } catch { /* Race still works if leaderboard session creation fails. */ }
      finally { clearTimeout(accountTimeout); }
      if (disposed) return;
      let ws: WebSocket;
      try { ws = new WebSocket(url); }
      catch { setConnection('error'); setError('Уралдааны сервертэй холбогдож чадсангүй.'); return; }
      socket = ws;
      socketRef.current = ws;
      // Updating a display name must never hold the lobby WebSocket behind another round trip.
      void fetch(base + '/api/account/name', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:nickname}), signal: controller.signal
      }).catch(() => { /* optional profile update */ });
      ws.onopen = () => { if (!disposed) { setConnection('connected'); setError(''); } };
    ws.onmessage = event => {
      if (disposed) return;
      try {
        const data = JSON.parse(event.data) as RoomSnapshot |
          { type: 'welcome'; id: string; resumeToken?: string; resumed?: boolean } | QuickResult;
        if (data.type === 'welcome') {
          latestMyId.current = data.id;
          setMyId(data.id);
          if (data.resumeToken) {
            try { window.sessionStorage.setItem(RESUME_KEY, data.resumeToken); } catch { /* optional */ }
          }
        }
        else if (data.type === 'state' && data.mode === 'quick') {
          if (!latestSnapshot.current || data.startAt !== latestSnapshot.current.startAt) {
            setClock({ serverNow: data.serverNow ?? Date.now(), receivedAt: performance.now() });
          }
          latestSnapshot.current = data;
          setSnapshot(data);
        }
        else if (data.type === 'quick-result') {
          receivedResult = true;
          try { window.sessionStorage.removeItem(RESUME_KEY); } catch { /* optional */ }
          if (!awardedMatches.current.has(data.raceId)) {
            awardedMatches.current.add(data.raceId);
            rewardRef.current(data);
          }
          setResult(data);
          if (latestSnapshot.current && latestMyId.current) {
            finishRef.current({ result: data, snapshot: latestSnapshot.current,
              playerId: latestMyId.current, at: Date.now() });
          }
        }
      } catch { setError('Серверийн хариу ойлгомжгүй байна.'); }
    };
    ws.onerror = () => { if (!disposed) setError('Холболт тасарлаа. Дахин оролдоно уу.'); };
    ws.onclose = () => {
      if (disposed || receivedResult) return;
      // The server holds this human's race slot for 15 seconds. Try a bounded,
      // short reconnect; later attempts remain a manual choice.
      let canResume = false;
      try { canResume = !!window.sessionStorage.getItem(RESUME_KEY); } catch { /* optional */ }
      if (canResume && attempt < 3) {
        setConnection('connecting');
        retryTimer = window.setTimeout(() => setAttempt(n => n + 1), 700 + attempt * 400);
      } else {
        setConnection('error');
        setError('Уралдааны холболт тасарлаа. Дахин нэгдэж болно.');
      }
    };
    })();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(accountTimeout);
      if (retryTimer) window.clearTimeout(retryTimer);
      socketRef.current = null;
      socket?.close();
    };
  // A new attempt is the only way to re-enter the queue. Prop changes during a race
  // never silently disconnect players.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const self = snapshot?.players.find(p => p.id === myId);
  const { signal, canType } = useRaceStart(snapshot?.phase, snapshot?.startAt, clock);
  const filled = snapshot?.players.length ?? 0;
  const myRank = snapshot && self ? 1 + snapshot.players.filter(p => p.id !== myId &&
    (p.progress > self.progress || (p.progress === self.progress &&
    p.completedAt !== null && (self.completedAt === null || p.completedAt < self.completedAt)))).length : null;
  const isRacing = canType && !result && connection === 'connected';
  const sendKey = useCallback((key: string) => sendRaceKey(socketRef.current, key), []);
  const canAcceptKey = useCallback(() => connection === 'connected' && !result &&
    raceCanType(latestSnapshot.current?.phase, latestSnapshot.current?.startAt, readRaceClock(clock)), [connection, result, clock]);

  return <div className="quick-page" data-testid="quick-race" data-start-signal={signal} data-keyboard-open={keyboardOpen}>
    <header className="quick-topline">
      <button className="back-link" onClick={onBack}>← БУЦАХ</button>
      <div className="quick-page-id">
        <strong>ШУУД УРАЛДААН</strong><span>5 ТОГЛОГЧ · МОНГОЛ ХЭЛ</span>
      </div>
      <span className={'quick-connection'+(connection === 'error' ? ' offline' : '')}>
        {connection === 'connected' ? '● ОНЛАЙН' : connection === 'error' ? '● ТАСАРСАН' : '○ ХОЛБОГДОЖ БАЙНА'}
      </span>
    </header>

    {connection === 'error' && !result && <section className="quick-state-panel" role="alert">
      <h2>ХОЛБОЛТ ТАСАРЛАА</h2><p>{error}</p>
      <button className="primary-button" onClick={() => setAttempt(n => n + 1)}>↻ ДАХИН НЭГДЭХ</button>
    </section>}
    {connection === 'connecting' && !snapshot && <section className="quick-state-panel" role="status">
      <h2>{attempt ? 'УРАЛДААНД ДАХИН ХОЛБОГДОЖ БАЙНА' : 'ТОГЛОГЧИДТОЙ ХОЛБОГДОЖ БАЙНА'}</h2><p>{attempt ? 'Durable Object-оос өмнөх байрлал, явцыг сэргээж байна…' : 'Уралдааны өрөөг нээж байна…'}</p>
    </section>}

    {snapshot && <div className={'quick-phase phase-'+snapshot.phase}
      data-testid="quick-phase" data-phase={snapshot.phase} role="status" aria-live="polite">
      {snapshot.phase === 'waiting' ? <>
        <span className="quick-phase-badge">1 / 2</span>
        <div className="quick-phase-copy">
          <strong>ТОГЛОГЧ ЦУГЛУУЛЖ БАЙНА</strong>
          <small>Хүн хүрэлцэхгүй бол бот нэг нэгээр нэгдэнэ. Одоохондоо бичихгүй.</small>
        </div>
        <span className="quick-phase-value">{filled}<em>/5</em></span>
      </> : snapshot.phase === 'countdown' ? <>
        <span className="quick-phase-badge">2 / 2</span>
        <div className="quick-phase-copy"><strong>ГАРААНД БЭЛЭН</strong>
          <small>Гэрэл ногоон болмогц бичиж эхлээрэй.</small></div>
      </> : snapshot.phase === 'racing' ? <>
        <span className="quick-phase-live">● ЭХЭЛЛЭЭ</span>
        <div className="quick-phase-copy"><strong>ОДОО БИЧЭЭРЭЙ!</strong>
          <small>Зөв бичих бүрт таны машин урагшилна.</small></div>
        <span className="quick-phase-rank">{myRank ? 'МИНИЙ БАЙР: ' + myRank + '/5' : 'УРАЛДАЖ БАЙНА'}</span>
      </> : <>
        <span className="quick-phase-live">✓ БАРИА</span>
        <strong className="quick-phase-copy">УРАЛДААН ДУУССАН</strong>
      </>}
    </div>}

    {snapshot && <section className="quick-track" aria-label="Таван тоглогчийн байрлал">
      {signal !== 'off' && <div className={'quick-start-lights signal-'+signal}
        role="status" aria-live="assertive" data-testid="race-start-lights" data-signal={signal}
        aria-label={signal === 'red' ? 'УЛААН. ХҮЛЭЭНЭ ҮҮ' : signal === 'yellow' ? 'ШАР. БЭЛД' : 'НОГООН. ЭХЭЛ'}>
        <div className="quick-start-housing" aria-hidden="true">
          <span className={'light-red'+(signal==='red'?' active':'')}/>
          <span className={'light-yellow'+(signal==='yellow'?' active':'')}/>
          <span className={'light-green'+(signal==='green'?' active':'')}/>
        </div>
        <strong>{signal==='red'?'ХҮЛЭЭ':signal==='yellow'?'БЭЛД':'ЭХЭЛ!'}</strong>
      </div>}
      <div className="quick-track-head">
        <span>УРАЛДАГЧИД</span>
        <strong>{filled} / 5 · {snapshot.players.filter(p => !p.bot).length} ХҮН · {snapshot.players.filter(p => p.bot).length} БОТ</strong>
      </div>
      <div className="quick-lanes">
        {snapshot.players.map((player,index) => {
          const which = carOf(player,index);
          const done = progressPercent(player.progress,snapshot.prompt.text);
          const rank = 1 + snapshot.players.filter(p => p.id !== player.id &&
            (p.progress > player.progress || (p.progress === player.progress &&
             p.completedAt !== null && (player.completedAt === null || p.completedAt < player.completedAt)))).length;
          return <QuickLane key={player.id} name={player.name} mine={player.id === myId}
            rank={snapshot.phase === 'racing' || snapshot.phase === 'finished' ? rank : index + 1}
            done={done} bot={!!player.bot} connected={player.connected !== false} car={which}/>;
        })}
        {snapshot.phase === 'waiting' && Array.from({length: Math.max(0,5 - filled)},(_,i) =>
          <div className="quick-empty" key={'empty'+i}><span>+</span> УРАЛДАГЧ ХҮЛЭЭЖ БАЙНА</div>)}
      </div>
    </section>}

    {snapshot && snapshot.phase !== 'finished' && <QuickTypingPanel
      key={snapshot.matchId || snapshot.prompt.id}
      text={snapshot.prompt.text}
      enabled={isRacing}
      available={connection === 'connected'}
      canAcceptKey={canAcceptKey}
      clock={clock}
      serverProgress={self?.progress || 0}
      serverStrokes={self?.strokes || 0}
      serverMistakes={self?.mistakes || 0}
      startedAt={snapshot.startAt}
      sendKey={sendKey}
    />}

    {result && <section className="quick-result-panel" aria-label="Уралдааны үр дүн">
      <div className="quick-result-top">{result.place ? 'УРАЛДААНЫГ ДУУСГАЛАА' : 'ХУГАЦАА ДУУССАН'}</div>
      <div className="quick-result-score"><div><small>БАЙР</small><strong>{result.place ? '#'+result.place : '—'}</strong></div>
        <div><small>ХУРД</small><strong>{result.wpm}<em> WPM</em></strong></div>
        <div><small>НАРИЙВЧЛАЛ</small><strong>{result.accuracy}%</strong></div>
        <div><small>ШАГНАЛ</small><strong>◈ {result.coins}</strong></div></div>
      <p>Дуусгасан байрнаас хамаарч тоглоомын зоос олгоно. Бүртгэлгүй учир зоос, XP энэ төхөөрөмжид хадгалагдана. Албан ёсны рейтинг биш.</p>
      <div className="quick-result-actions">
        <button className="primary-button" onClick={() => setAttempt(n => n + 1)}>▶ ДАХИН УРАЛДАХ →</button>
        <button className="secondary-button" onClick={onGarage}>ГАРАЖ</button>
        <button className="secondary-button" onClick={onBack}>БУЦАХ</button>
      </div>
    </section>}
    <div className="quick-footer-note">Автоматаар хүн хайна · Хүрэлцэхгүй бол ботоор нөхнө · Бодит болон бот тоглогчдыг тусад нь тэмдэглэнэ · Уралдааны зоос бодит мөнгө биш.</div>
  </div>;
}
