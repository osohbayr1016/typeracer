import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  accuracyPercent, characters, progressPercent, wordsPerMinute,
  type RoomSnapshot, type Racer
} from '@typeracer/shared';
import { CARS, type Skin } from './cars';
import { STICKER_SYMBOLS, type Profile } from '../progression';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const rewardRef = useRef(onReward);
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
          setResult(previous => {
            if (previous?.raceId === data.raceId) return previous;
            rewardRef.current(data);
            return data;
          });
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
    const timer = window.setInterval(() => setNow(Date.now()), 125);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (snapshot?.phase !== 'racing' || result) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [snapshot?.phase, result]);

  const self = snapshot?.players.find(p => p.id === myId);
  const elapsed = snapshot?.startAt ? Math.max(0, now - snapshot.startAt) : 0;
  const queueSeconds = snapshot?.phase === 'waiting' && snapshot.queueEndsAt
    ? Math.max(0, Math.ceil((snapshot.queueEndsAt - now) / 1000)) : 0;
  const count = snapshot?.phase === 'countdown' && snapshot.startAt
    ? Math.max(1, Math.ceil((snapshot.startAt - now) / 1000)) : 0;
  const isRacing = snapshot?.phase === 'racing' && !result;
  const typedCount = self?.progress || 0;
  const accuracy = self ? accuracyPercent(Math.max(0, self.strokes - self.mistakes), self.strokes) : 100;
  const wpm = self && snapshot?.startAt ? wordsPerMinute(self.progress, Math.max(1, elapsed)) : 0;

  function onType(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if ((event.nativeEvent as InputEvent).isComposing) return;
    const keys = characters(input.value).slice(0, 8);
    input.value = '';
    const socket = socketRef.current;
    if (!isRacing || socket?.readyState !== WebSocket.OPEN) return;
    for (const key of keys) socket.send(JSON.stringify({ type: 'key', key }));
  }

  return <div className="quick-page" data-testid="quick-race">
    <div className="quick-topline">
      <button className="back-link" onClick={onBack}>← ТОГЛОХ ХЭСЭГ</button>
      <span className="section-kicker">ОЛОН ТОГЛОГЧ · ШУУД УРАЛДААН</span>
      <span className="quick-connection">{connection === 'connected' ? '● ОНЛАЙН' : '○ ХОЛБОГДОЖ БАЙНА'}</span>
    </div>
    <div className="quick-heading">
      <div><span className="section-kicker">МОНГОЛ ХЭЛНИЙ УРАЛДААН</span>
        <h1>{result ? 'БАРИА <span>ҮР ДҮН</span>' : 'ШУУД <span>УРАЛДААН</span>'}</h1>
        <p>Бодит тоглогчидтой уралдана. Хүн хүрэлцэхгүй бол бот уралдагчид нэмэгдэнэ.</p></div>
      <div className="quick-small-stat"><small>ТЭРГҮҮН БАЙРЫН ШАГНАЛ</small><strong>◈ 120</strong><span>Зөвхөн тоглоомын зоос</span></div>
    </div>

    {connection === 'error' && !result && <section className="quick-state-panel" role="alert">
      <h2>ХОЛБОЛТ ТАСАРЛАА</h2><p>{error}</p>
      <button className="primary-button" onClick={() => setAttempt(n => n + 1)}>↻ ДАХИН НЭГДЭХ</button>
    </section>}
    {connection === 'connecting' && !snapshot && <section className="quick-state-panel">
      <h2>СЕРВЕРТЭЙ ХОЛБОГДОЖ БАЙНА</h2><p>Бодит тоглогчидтой уралдах өрөөг хайж байна...</p>
    </section>}
    {snapshot && <section className="quick-track" aria-label="Шууд уралдааны зам">
      <div className="quick-track-head">
        <span>{snapshot.phase === 'waiting' ? 'ТОГЛОГЧ ХАЙЖ БАЙНА' :
          snapshot.phase === 'countdown' ? 'ГАРААНД БЭЛЭН' :
          snapshot.phase === 'racing' ? 'УРАЛДААН ҮРГЭЛЖИЛЖ БАЙНА' : 'УРАЛДААН ДУУССАН'}</span>
        <strong>{snapshot.players.filter(p => !p.bot).length} ХҮН · {snapshot.players.filter(p => p.bot).length} БОТ</strong>
      </div>
      {(snapshot.phase === 'waiting' || snapshot.phase === 'countdown') && <div className="quick-lobby-status" role="status">
        <strong>{snapshot.phase === 'waiting' ? queueSeconds : count}</strong>
        <span>{snapshot.phase === 'waiting' ? 'секундын дараа ботуудаар нөхөж эхэлнэ' : 'Гарааны тоолол'}</span>
      </div>}
      <div className="quick-lanes">
        {snapshot.players.map((player,index) => {
          const which = carOf(player,index);
          const done = progressPercent(player.progress,snapshot.prompt.text);
          return <div className={'quick-lane'+(player.id === myId?' me':'')} key={player.id}>
            <div className="quick-lane-meta">
              <span className="quick-lane-order">{String(index+1).padStart(2,'0')}</span>
              <div><strong>{player.name}{player.id===myId ? ' · ТА' : ''}</strong>
                <small>{player.bot ? 'БОТ УРАЛДАГЧ' : 'БОДИТ ТОГЛОГЧ'}</small></div>
              <b>{done}%</b>
            </div>
            <div className="quick-road">
              <span className="quick-road-progress" style={{ width: done+'%' }}/>
              <img src={CARS[which].icon} alt="" draggable={false}
                style={{ left: (2 + done*.70)+'%' }}/>
              <span className="quick-flag"/>
            </div>
          </div>;
        })}
        {snapshot.phase === 'waiting' && Array.from({length: Math.max(0,4 - snapshot.players.length)},(_,i) =>
          <div className="quick-empty" key={'empty'+i}>+ ТОГЛОГЧ ХҮЛЭЭЖ БАЙНА</div>)}
      </div>
    </section>}

    {snapshot?.phase === 'racing' && !result && <section className="quick-type-panel">
      <div className="quick-type-head"><strong>ДООРХ ӨГҮҮЛБЭРИЙГ БИЧНЭ ҮҮ</strong><span>{typedCount} / {characters(snapshot.prompt.text).length} тэмдэгт</span></div>
      <div className="quick-phrase" role="group" aria-label="Бичих текст">
        {characters(snapshot.prompt.text).map((letter,i)=>
          <span key={i} className={i < typedCount ? 'typed' : i === typedCount ? 'cursor' : undefined}>{letter === ' ' ? '\u00a0' : letter}</span>)}
      </div>
      <input ref={inputRef} className="quick-type-input" aria-label="Шууд уралдааны бичих талбар"
        autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
        onChange={onType} placeholder="Энд бичиж эхлээрэй..." />
      <div className="quick-metrics">
        <div><b>{wpm}</b><small>ҮГ/МИН</small></div><div><b>{accuracy}%</b><small>НАРИЙВЧЛАЛ</small></div>
        <div><b>{(elapsed/1000).toFixed(1)}s</b><small>ХУГАЦАА</small></div>
      </div>
    </section>}

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
