import { useCallback, useEffect, useRef, useState } from 'react';
import {
  progressPercent, type RoomSnapshot, type Racer
} from '@typeracer/shared';
import { CARS, type Skin } from './cars';
import { type Profile } from '../progression';
import { QuickTypingPanel } from './QuickTypingPanel';
import './QuickRacePage.css';

export type QuickResult = {
  type: 'quick-result'; raceId: string; place: number | null; coins: number;
  wpm: number; accuracy: number; elapsedMs: number; verified: false;
};
type Props = {
  car: Skin; profile: Profile; nickname: string;
  onBack: () => void; onGarage: () => void; onReward: (result: QuickResult) => void;
};
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BOT_CARS: Skin[] = ['mint','steppe','thunder'];

function carOf(player: Racer, index: number): Skin {
  return player.car && player.car in CARS ? player.car as Skin : BOT_CARS[index % BOT_CARS.length];
}
export function QuickRacePage({ car, profile, nickname, onBack, onGarage, onReward }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [myId, setMyId] = useState('');
  const [result, setResult] = useState<QuickResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const rewardRef = useRef(onReward);
  const awardedMatches = useRef(new Set<string>());
  rewardRef.current = onReward;

  useEffect(() => {
    let disposed = false;
    setConnection('connecting'); setError(''); setResult(null); setSnapshot(null); setMyId('');
    const base = API_BASE || window.location.origin;
    const params = new URLSearchParams({ name: nickname, car, trail: profile.trail,
      sticker: profile.sticker, title: profile.title });
    const url = base.replace(/^http/, 'ws') + '/api/quickplay/ws?' + params;
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch { setConnection('error'); setError('Уралдааны сервертэй холбогдож чадсангүй.'); return; }
    socketRef.current = socket;
    socket.onopen = () => { if (!disposed) { setConnection('connected'); setError(''); } };
    socket.onmessage = event => {
      if (disposed) return;
      try {
        const data = JSON.parse(event.data) as RoomSnapshot | { type: 'welcome'; id: string } | QuickResult;
        if (data.type === 'welcome') setMyId(data.id);
        else if (data.type === 'state' && data.mode === 'quick') setSnapshot(data);
        else if (data.type === 'quick-result') {
          if (!awardedMatches.current.has(data.raceId)) {
            awardedMatches.current.add(data.raceId);
            rewardRef.current(data);
          }
          setResult(data);
        }
      } catch { setError('Серверийн хариу ойлгомжгүй байна.'); }
    };
    socket.onerror = () => { if (!disposed) setError('Холболт тасарлаа. Дахин оролдоно уу.'); };
    socket.onclose = () => {
      if (!disposed) {
        setConnection('error');
        setError('Уралдааны холболт тасарлаа. Дахин нэгдэж болно.');
      }
    };
    return () => { disposed = true; socketRef.current = null; socket.close(); };
  // A new attempt is the only way to re-enter the queue. Prop changes during a race
  // never silently disconnect players.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  const self = snapshot?.players.find(p => p.id === myId);
  const countdown = snapshot?.phase === 'countdown' && snapshot.startAt
    ? Math.max(1, Math.ceil((snapshot.startAt - now) / 1000)) : 0;
  const filled = snapshot?.players.length ?? 0;
  const myRank = snapshot && self ? 1 + snapshot.players.filter(p => p.id !== myId &&
    (p.progress > self.progress || (p.progress === self.progress &&
    p.completedAt !== null && (self.completedAt === null || p.completedAt < self.completedAt)))).length : null;
  const isRacing = snapshot?.phase === 'racing' && !result && connection === 'connected';
  const sendKey = useCallback((key: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'key', key }));
  }, []);

  return <div className="quick-page" data-testid="quick-race">
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
      <h2>ТОГЛОГЧИДТОЙ ХОЛБОГДОЖ БАЙНА</h2><p>Уралдааны өрөөг нээж байна…</p>
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
        <div className="quick-phase-copy"><strong>БҮГД БЭЛЭН · ГАРААНЫ ТООЛОЛ</strong>
          <small>Бичих текстээ хараарай. Тэг болоход бичиж эхэлнэ.</small></div>
        <strong className="quick-phase-value" data-testid="race-start-countdown">{countdown}</strong>
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
          return <div className={'quick-lane'+(player.id === myId?' me':'')} key={player.id}>
            <div className="quick-lane-meta">
              <span className="quick-lane-order">{snapshot.phase === 'racing' || snapshot.phase === 'finished' ? rank : index + 1}</span>
              <div><strong>{player.name}{player.id===myId ? ' · ТА' : ''}</strong>
                <small>{player.bot ? 'БОТ' : 'ТОГЛОГЧ'}</small></div>
              <b>{done}%</b>
            </div>
            <div className="quick-road">
              <span className="quick-road-progress" style={{ width: done+'%' }}/>
              <img src={CARS[which].icon} alt="" draggable={false}
                style={{ left: (done * .71)+'%' }}/>
              <span className="quick-flag" aria-hidden="true"/>
            </div>
          </div>;
        })}
        {snapshot.phase === 'waiting' && Array.from({length: Math.max(0,5 - filled)},(_,i) =>
          <div className="quick-empty" key={'empty'+i}><span>+</span> УРАЛДАГЧ ХҮЛЭЭЖ БАЙНА</div>)}
      </div>
    </section>}

    {snapshot && snapshot.phase !== 'finished' && <QuickTypingPanel
      key={snapshot.matchId || snapshot.prompt.id}
      text={snapshot.prompt.text}
      enabled={isRacing}
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
