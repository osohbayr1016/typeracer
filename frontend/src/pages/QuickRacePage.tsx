import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  characters, type RoomSnapshot, type Racer, type TypingProgress, type InputAcknowledgement
} from '@typeracer/shared';
import { CARS, raceCarIcon, type Skin } from './cars';
import { type Profile } from '../progression';
import { QuickTypingPanel } from './QuickTypingPanel';
import { sendRaceKey } from './typingSync';
import { ReliableRaceInput } from './reliableInput';
import { paymentSession } from '../payments';
import { raceCanType } from './raceStartSignal';
import { readRaceClock, useRaceStart, type ServerClock } from './useRaceStart';
import { type QuickRaceOutcome, type QuickResult } from './quickResultsModel';
import { finishPlace, laneWpm, liveRank, placeLabel } from './raceView';
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
/** The finish moment stays on the track briefly (place, speed, prize) before the full results page opens. */
export const FINISH_HOLD_MS = 1500;
const STEPS = ['ЦУГЛУУЛГА', 'ГАРАА', 'УРАЛДААН'] as const;

function carOf(player: Racer, index: number): Skin {
  return player.car && player.car in CARS ? player.car as Skin : BOT_CARS[index % BOT_CARS.length];
}
const QuickLane = memo(function QuickLane({ name, mine, rank, done, bot, connected, car, trail, sticker, title, wpm, place, live }: {
  name: string; mine: boolean; rank: number; done: number; bot: boolean; connected: boolean; car: Skin;
  trail?: string; sticker?: string; title?: string; wpm: number; place: number | null; live: boolean;
}) {
  return <div className={'quick-lane'+(mine?' me':'')+(place?' finished':'')}>
    <div className="quick-lane-meta">
      <span className="quick-lane-order">{rank}</span>
      <div><strong>{title === 'supporter' && <span className="supporter-name" aria-label="Дэмжигч">♛ </span>}{name}{mine ? ' · ТА' : ''}</strong>
        <small>{bot ? 'БОТ' : !connected ? 'ХОЛБОЛТ ТАСАРСАН' : 'ТОГЛОГЧ'}{live && <i className="quick-lane-mini"> · {place ? placeLabel(place) + ' · ' : ''}{wpm} WPM</i>}</small></div>
      <b>{Math.round(done)}%</b>
    </div>
    <div className="quick-road">
      <span className="quick-road-progress" style={{ transform: `scaleX(${done / 100})` }}/>
      <span className="quick-car-position" style={{ transform: `translate3d(${done}%,0,0)` }}>
        <span className={'quick-car-sprite trail-' + (trail || 'none')} style={{ transform: `translate3d(-${done}%,0,0)` }}>
          {trail === 'gold' && <span className="quick-paid-trail" aria-hidden="true"/>}
          <img src={raceCarIcon(car)} alt="" draggable={false} decoding="async"/>
          {sticker === 'crown' && <i className="quick-paid-sticker" aria-hidden="true">♛</i>}
        </span>
      </span>
      <span className="quick-flag" aria-hidden="true"/>
    </div>
    <div className="quick-lane-telemetry">
      {place ? <em className="quick-lane-place">{placeLabel(place)} байр</em> : <em className="quick-lane-place muted">{live ? 'уралдаж байна' : 'бэлэн'}</em>}
      <span className="quick-lane-wpm">{live ? wpm : '–'}<small>WPM</small></span>
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
  const [now, setNow] = useState(() => Date.now());
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [prediction, setPrediction] = useState<TypingProgress | null>(null);
  const [syncSlow, setSyncSlow] = useState(false);
  const reliableInput = useRef<ReliableRaceInput | null>(null);
  const reliableVersion = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const rewardRef = useRef(onReward);
  const finishRef = useRef(onFinish);
  const finishNow = useRef<(() => void) | null>(null);
  const latestSnapshot = useRef<RoomSnapshot | null>(null);
  const latestMyId = useRef('');
  const awardedMatches = useRef(new Set<string>());
  rewardRef.current = onReward;
  finishRef.current = onFinish;

  useEffect(() => {
    const timer = setInterval(() => {
      const input = reliableInput.current;
      if (!input || !reliableVersion.current) return;
      const now = performance.now();
      input.flush(socketRef.current, now);
      setSyncSlow(input.delayed(now));
    }, 450);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setKeyboardOpen(!!viewport && viewport.height < window.innerHeight - 120);
    viewport?.addEventListener('resize', update);
    return () => viewport?.removeEventListener('resize', update);
  }, []);

  // One shared race clock drives the countdown number and every lane's live WPM.
  const phase = snapshot?.phase;
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'racing') return;
    const tick = () => setNow(readRaceClock(clock));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phase, clock]);

  useEffect(() => {
    let disposed = false;
    let receivedResult = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const accountTimeout = setTimeout(() => controller.abort(), 3000);
    setConnection('connecting'); setError(''); setResult(null); setSnapshot(null); setMyId('');
    latestSnapshot.current = null;
    finishNow.current = null;
    setClock(null);
    const base = API_BASE || window.location.origin;
    const params = new URLSearchParams({ input:'2', name: nickname, car, trail: profile.trail,
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
        await paymentSession();
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
          { type: 'welcome'; id: string; resumeToken?: string; resumed?: boolean; inputVersion?: number } | QuickResult | InputAcknowledgement;
        if (data.type === 'welcome') {
          reliableVersion.current = data.inputVersion === 2;
          if (!reliableVersion.current) { reliableInput.current = null; setPrediction(null); }
          latestMyId.current = data.id;
          setMyId(data.id);
          if (data.resumeToken) {
            try { window.sessionStorage.setItem(RESUME_KEY, data.resumeToken); } catch { /* optional */ }
          }
        }
        else if (data.type === 'input-ack' && reliableInput.current?.matchId === data.matchId) {
          reliableInput.current.acknowledge(data);
          setPrediction(reliableInput.current.prediction);
        }
        else if (data.type === 'state' && data.mode === 'quick') {
          if (reliableVersion.current && data.matchId) {
            if (reliableInput.current?.matchId !== data.matchId)
              reliableInput.current = new ReliableRaceInput(data.matchId, data.prompt.text);
            const current = data.players.find(player => player.id === latestMyId.current);
            if (current && typeof current.inputSeq === 'number') reliableInput.current.acknowledge({
              seq:current.inputSeq,progress:current.progress,strokes:current.strokes,mistakes:current.mistakes,wrong:current.inputWrong
            });
            setPrediction(reliableInput.current.prediction);
          }
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
            const playerId = latestMyId.current;
            const snapshotAtResult = latestSnapshot.current;
            const open = () => {
              if (finishTimer) clearTimeout(finishTimer);
              finishTimer = null;
              finishNow.current = null;
              // The newest snapshot shows how the others finished during the hold.
              finishRef.current({ result: data, snapshot: latestSnapshot.current ?? snapshotAtResult, playerId, at: Date.now() });
            };
            // Let the racer see their place on the track, then open the full results.
            if (finishTimer) clearTimeout(finishTimer);
            finishTimer = setTimeout(open, FINISH_HOLD_MS);
            finishNow.current = open;
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
      if (finishTimer) clearTimeout(finishTimer);
      finishNow.current = null;
      socketRef.current = null;
      socket?.close();
    };
  // A new attempt is the only way to re-enter the queue. Prop changes during a race
  // never silently disconnect players.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Enter skips the finish hold, like pressing the results button.
  useEffect(() => {
    if (!result) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Enter') finishNow.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result]);

  const self = snapshot?.players.find(p => p.id === myId);
  const { signal, canType } = useRaceStart(snapshot?.phase, snapshot?.startAt, clock);
  const filled = snapshot?.players.length ?? 0;
  const humans = snapshot?.players.filter(p => !p.bot).length ?? 0;
  const letterCount = snapshot ? characters(snapshot.prompt.text).length : 1;
  const underway = snapshot?.phase === 'racing' || snapshot?.phase === 'finished';
  const myRank = snapshot && self ? liveRank(self, snapshot.players) : null;
  const myPlace = snapshot && self ? finishPlace(self, snapshot.players) : null;
  const secondsToStart = snapshot?.phase === 'countdown' && snapshot.startAt
    ? Math.max(0, Math.ceil((snapshot.startAt - now) / 1000)) : null;
  const stepIndex = snapshot?.phase === 'waiting' ? 0 : snapshot?.phase === 'countdown' ? 1 : 2;
  const isRacing = canType && !result && connection === 'connected';
  const sendKey = useCallback((key: string) => {
    if (!reliableVersion.current || !reliableInput.current) return sendRaceKey(socketRef.current, key);
    const accepted = reliableInput.current.enqueue(key, socketRef.current, performance.now());
    if (accepted) setPrediction(reliableInput.current.prediction);
    else if (socketRef.current?.readyState === 1) setSyncSlow(true);
    return accepted;
  }, []);
  const canAcceptKey = useCallback(() => connection === 'connected' && !result &&
    raceCanType(latestSnapshot.current?.phase, latestSnapshot.current?.startAt, readRaceClock(clock)), [connection, result, clock]);

  return <div className="quick-page" data-testid="quick-race" data-start-signal={signal} data-keyboard-open={keyboardOpen}>
    <header className="quick-topline">
      <button className="back-link" onClick={onBack}>← БУЦАХ</button>
      <div className="quick-page-id">
        <strong>ШУУД УРАЛДААН</strong><span>5 ТОГЛОГЧ · МОНГОЛ ХЭЛ</span>
      </div>
      <span className={'quick-connection'+(connection === 'error' ? ' offline' : '')}>
        {connection === 'connected' ? (syncSlow ? '● СИНК ХИЙЖ БАЙНА' : '● ОНЛАЙН') : connection === 'error' ? '● ТАСАРСАН' : '○ ХОЛБОГДОЖ БАЙНА'}
      </span>
    </header>

    {connection === 'error' && !result && <section className="quick-state-panel" role="alert">
      <h2>ХОЛБОЛТ ТАСАРЛАА</h2><p>{error}</p>
      <button className="primary-button" onClick={() => setAttempt(n => n + 1)}>↻ ДАХИН НЭГДЭХ</button>
    </section>}
    {connection === 'connecting' && !snapshot && <section className="quick-state-panel" role="status">
      <h2>{attempt ? 'УРАЛДААНД ДАХИН ХОЛБОГДОЖ БАЙНА' : 'ТОГЛОГЧИДТОЙ ХОЛБОГДОЖ БАЙНА'}</h2><p>{attempt ? 'Таны уралдааны явцыг сэргээж байна…' : 'Уралдааны өрөөг нээж байна…'}</p>
    </section>}

    {snapshot && <div className={'quick-phase phase-'+snapshot.phase}
      data-testid="quick-phase" data-phase={snapshot.phase} role="status" aria-live="polite">
      <ol className="quick-steps" aria-hidden="true">
        {STEPS.map((label, index) => <li key={label}
          className={index < stepIndex ? 'done' : index === stepIndex ? 'active' : undefined}>{label}</li>)}
      </ol>
      <div className="quick-phase-copy">
        {snapshot.phase === 'waiting' ? <>
          <strong>ТОГЛОГЧ ЦУГЛУУЛЖ БАЙНА</strong>
          <small>Хүн хүрэлцэхгүй бол бот нэг нэгээр нэгдэнэ. Одоохондоо текстээ уншиж бэлдээрэй.</small>
        </> : snapshot.phase === 'countdown' ? <>
          <strong>ГАРААНД БЭЛЭН</strong>
          <small>Гэрэл ногоон болмогц бичиж эхлээрэй.</small>
        </> : snapshot.phase === 'racing' ? <>
          <strong>{myPlace ? 'БАРИАНД ОРЛОО' : 'ОДОО БИЧЭЭРЭЙ!'}</strong>
          <small>{myPlace ? 'Бусад уралдагчдыг хүлээж байна…' : 'Зөв бичих бүрт таны машин урагшилна.'}</small>
        </> : <>
          <strong>УРАЛДААН ДУУССАН</strong>
          <small>Үр дүн бэлэн боллоо.</small>
        </>}
      </div>
      <span className="quick-phase-value">
        {snapshot.phase === 'waiting' ? <>{filled}<em>/5</em></>
          : snapshot.phase === 'countdown' ? <>{secondsToStart ?? '…'}<em>сек</em></>
          : snapshot.phase === 'racing' ? <>{myPlace ? '#' + myPlace : myRank ? '#' + myRank : '—'}<em>{myPlace ? 'бариа' : 'байр'}</em></>
          : <>✓</>}
      </span>
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
      {result && <div className="quick-finish-card" role="status" aria-live="assertive" data-testid="quick-finish">
        <span className="quick-finish-kicker">{result.place ? 'БАРИАНД ОРЛОО' : 'ХУГАЦАА ДУУССАН'}</span>
        <strong className="quick-finish-place">{result.place ? placeLabel(result.place) + ' байр' : 'Дуусаагүй'}</strong>
        <div className="quick-finish-stats">
          <span><b>{result.wpm}</b> WPM</span>
          <span><b>{result.accuracy}%</b> нарийвчлал</span>
          <span><b>◈ +{result.coins}</b> зоос</span>
        </div>
        <button type="button" className="quick-finish-open" onClick={() => finishNow.current?.()}>ҮР ДҮН ХАРАХ → <kbd>Enter</kbd></button>
      </div>}
      <div className="quick-track-head">
        <span>УРАЛДАГЧИД</span>
        <strong>{filled} / 5 · {humans} ХҮН · {filled - humans} БОТ</strong>
      </div>
      <div className="quick-lanes">
        {snapshot.players.map((player,index) => {
          const which = carOf(player,index);
          const mine = player.id === myId;
          const shown = mine && prediction ? prediction.progress : player.progress;
          const done = Math.min(100, shown / letterCount * 100);
          const place = underway ? finishPlace(player, snapshot.players) : null;
          const wpm = underway ? laneWpm(mine && prediction && player.completedAt === null
            ? { progress: prediction.progress, completedAt: null } : player, snapshot.startAt, now) : 0;
          return <QuickLane key={player.id} name={player.name} mine={mine}
            rank={underway ? liveRank(player, snapshot.players) : index + 1}
            done={done} bot={!!player.bot} connected={player.connected !== false} car={which}
            trail={player.trail} sticker={player.sticker} title={player.title}
            wpm={wpm} place={place} live={underway}/>;
        })}
        {snapshot.phase === 'waiting' && Array.from({length: Math.max(0,5 - filled)},(_,i) =>
          <div className="quick-empty" key={'empty'+i}><span>+</span> УРАЛДАГЧ ХҮЛЭЭЖ БАЙНА</div>)}
      </div>
    </section>}

    {snapshot && <QuickTypingPanel
      key={snapshot.matchId || snapshot.prompt.id}
      text={snapshot.prompt.text}
      title={snapshot.prompt.title}
      part={snapshot.prompt.part}
      prediction={prediction}
      syncing={syncSlow}
      enabled={isRacing}
      available={connection === 'connected'}
      finished={!!myPlace || !!result?.place}
      ended={snapshot.phase === 'finished' || (!!result && result.place === null)}
      rank={myPlace ?? myRank}
      canAcceptKey={canAcceptKey}
      clock={clock}
      serverProgress={self?.progress || 0}
      serverStrokes={self?.strokes || 0}
      serverMistakes={self?.mistakes || 0}
      startedAt={snapshot.startAt}
      sendKey={sendKey}
    />}

    {snapshot?.phase === 'finished' && !result && <section className="quick-result-panel" aria-label="Уралдаан дууссан">
      <div className="quick-result-top">УРАЛДААН ДУУССАН</div>
      <div className="quick-result-actions">
        <button className="primary-button" onClick={() => setAttempt(n => n + 1)}>▶ ДАХИН УРАЛДАХ</button>
        <button className="secondary-button" onClick={onGarage}>ГАРАЖ</button>
      </div>
    </section>}
    <div className="quick-footer-note">Хүн хүрэлцэхгүй бол бот нэгдэнэ · Бот тоглогчдыг тусад нь тэмдэглэнэ · Уралдааны зоос бодит мөнгө биш.</div>
  </div>;
}
