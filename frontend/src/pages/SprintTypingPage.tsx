import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { characters } from '@typeracer/shared';
import { EMPTY_SPRINT, SPRINT_DURATIONS, sprintAdvance, sprintDailyKey, sprintScore, sprintSeed, sprintText,
  type SprintDuration, type SprintProgress } from './sprintModel';
import './SprintTypingPage.css';

type Props = { daily: boolean; onHome: () => void; onRace: () => void; onDaily: () => void };
type FinalScore = ReturnType<typeof sprintScore> & { newBest: boolean };
const readBest = (key: string): number => {
  try { return Math.max(0, Number(window.localStorage.getItem(key)) || 0); }
  catch { return 0; }
};

export function SprintTypingPage({ daily, onHome, onRace, onDaily }: Props) {
  const day = useMemo(() => sprintDailyKey(), []);
  const [duration, setDuration] = useState<SprintDuration>(daily ? 30 : 15);
  const [round, setRound] = useState(0);
  const [progress, setProgress] = useState<SprintProgress>(EMPTY_SPRINT);
  const progressRef = useRef<SprintProgress>(EMPTY_SPRINT);
  const startRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(duration * 1000);
  const [wrong, setWrong] = useState(false);
  const [finalScore, setFinalScore] = useState<FinalScore | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const storageKey = daily ? 'racer.daily.pb.' + day : 'racer.sprint.pb.' + duration;
  const [best, setBest] = useState(() => readBest(storageKey));
  const passage = useMemo(() => sprintText(daily ? sprintSeed(day) : (Date.now() + Math.imul(round + 1, 7919)) >>> 0), [daily, day, round]);
  const letters = useMemo(() => characters(passage), [passage]);
  const finish = useCallback((at: number) => {
    if (finishedRef.current || startRef.current === null) return;
    finishedRef.current = true;
    const elapsedMs = Math.min(duration * 1000, Math.max(1, at - startRef.current));
    const score = sprintScore(progressRef.current, elapsedMs);
    const previous = readBest(storageKey);
    const newBest = score.wpm > previous;
    if (newBest) {
      try { window.localStorage.setItem(storageKey, String(score.wpm)); } catch { /* Private mode: score remains visible. */ }
      setBest(score.wpm);
    }
    setRemainingMs(Math.max(0, duration * 1000 - elapsedMs));
    setFinalScore({ ...score, newBest });
    setRunning(false);
  }, [duration, storageKey]);

  useEffect(() => {
    if (!running) return;
    const update = () => {
      if (startRef.current === null) return;
      const left = Math.max(0, duration * 1000 - (performance.now() - startRef.current));
      setRemainingMs(left);
      if (left <= 0) finish(startRef.current + duration * 1000);
    };
    const timer = window.setInterval(update, 50);
    return () => window.clearInterval(timer);
  }, [running, duration, finish]);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches && !finalScore) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [passage, finalScore]);

  function reset(nextDuration: SprintDuration = duration) {
    finishedRef.current = false;
    startRef.current = null;
    progressRef.current = EMPTY_SPRINT;
    setProgress(EMPTY_SPRINT);
    setRunning(false);
    setDuration(nextDuration);
    setRemainingMs(nextDuration * 1000);
    setWrong(false);
    setFinalScore(null);
    setShareMessage('');
    setBest(readBest(daily ? 'racer.daily.pb.' + day : 'racer.sprint.pb.' + nextDuration));
    setRound(value => value + 1);
    if (!window.matchMedia('(pointer: coarse)').matches) {
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }

  function accept(value: string) {
    if (finishedRef.current || !value) return;
    // Composition can produce multiple characters on some keyboards; never treat
    // an inserted phrase as a set of valid keystrokes.
    const keys = characters(value.normalize('NFC'));
    if (keys.length !== 1) return;
    const at = performance.now();
    if (startRef.current !== null && at >= startRef.current + duration * 1000) {
      finish(startRef.current + duration * 1000);
      return;
    }
    if (startRef.current === null) {
      startRef.current = at;
      setRunning(true);
    }
    const next = sprintAdvance(progressRef.current, keys[0], passage);
    if (next === progressRef.current) return;
    setWrong(next.mistakes > progressRef.current.mistakes);
    progressRef.current = next;
    setProgress(next);
    if (next.position === letters.length) finish(at);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    if (composing.current || (event.nativeEvent as InputEvent).isComposing) return;
    const value = event.currentTarget.value;
    event.currentTarget.value = '';
    accept(value);
  }

  async function share() {
    if (!finalScore) return;
    const url = new URL(daily ? '/daily' : '/sprint', window.location.origin).toString();
    const message = (daily ? 'Өнөөдрийн Монгол typing challenge' : duration + ' секундийн typing sprint') +
      ': ' + finalScore.wpm + ' WPM · ' + finalScore.accuracy + '% нарийвчлал. Чи хэдийг авах вэ? ' + url;
    try {
      if (navigator.share) await navigator.share({ title: 'TypeRacer Mongolia', text: message, url });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setShareMessage('Үр дүн болон сорилын холбоосыг хууллаа.');
      } else setShareMessage('Энэ төхөөрөмж дээр хуваалцах боломжгүй байна.');
    } catch {
      setShareMessage('Хуваалцах үйлдэл цуцлагдсан.');
    }
  }

  const visibleStart = Math.max(0, Math.floor(progress.position / 140) * 140);
  const shown = letters.slice(visibleStart, visibleStart + 280);
  const currentWpm = running && startRef.current !== null
    ? sprintScore(progress, Math.max(1000, duration * 1000 - remainingMs)).wpm : (finalScore?.wpm ?? 0);
  const currentAccuracy = sprintScore(progress, Math.max(1000, duration * 1000 - remainingMs)).accuracy;

  return <div className="sprint-page" data-testid="sprint-page">
    <div className="sprint-topline">
      <button className="back-link" type="button" onClick={onHome}>← НҮҮР ХУУДАС</button>
      <span>{daily ? 'ӨДРИЙН СОРИЛ · МОНГОЛЫН ЦАГ' : 'SOLO PRACTICE · МОНГОЛ ХЭЛ'}</span>
      <button type="button" className="sprint-online-link" onClick={onRace}>Онлайн уралдах →</button>
    </div>
    <header className="sprint-heading">
      <span className="sprint-kicker">{daily ? day + ' · БҮГД ИЖИЛ ТЕКСТ' : 'БИЧИХ ХУРДАА САЙЖРУУЛ'}</span>
      <h1>{daily ? 'ӨНӨӨДРИЙН СОРИЛ' : 'ХУРДНЫ ШАЛГАЛТ'}<span>.</span></h1>
      <p>{daily ? 'Өнөөдөр бүх хүн ижил 30 секундийн текст бичнэ. Энэ нь хувийн дасгалын дүн бөгөөд албан ёсны rank биш.' :
        'Таймер эхний үсэгтэй зэрэг эхэлнэ. Алдаа гарвал зөв үсэг бичтэл курсор урагшлахгүй.'}</p>
    </header>
    {!daily && <div className="sprint-modes" role="group" aria-label="Бичих хугацаа">
      {SPRINT_DURATIONS.map(seconds => <button key={seconds} type="button" aria-pressed={duration === seconds}
        className={duration === seconds ? 'selected' : ''} onClick={() => reset(seconds)}>{seconds} сек</button>)}
      <button type="button" className="sprint-daily-link" onClick={onDaily}>Өнөөдрийн сорил →</button>
    </div>}
    <section className="sprint-stage" aria-label="Бичих шалгалт">
      <div className="sprint-stage-top">
        <span>{finalScore ? 'ШАЛГАЛТ ДУУССАН' : running ? 'БИЧИЖ БАЙНА' : 'БИЧИХЭД БЭЛЭН'}</span>
        <strong data-testid="sprint-countdown">{(remainingMs / 1000).toFixed(1)} <small>сек</small></strong>
      </div>
      <div className="sprint-timer-track" role="progressbar" aria-label="Үлдсэн хугацаа" aria-valuemin={0}
        aria-valuemax={duration * 1000} aria-valuenow={Math.round(remainingMs)}>
        <span style={{ transform: 'scaleX(' + (remainingMs / (duration * 1000)) + ')' }}/>
      </div>
      <div className="sprint-phrase" data-testid="sprint-passage" aria-label="Бичих текст"
        onClick={() => inputRef.current?.focus()}>
        {shown.map((letter, index) => {
          const absolute = visibleStart + index;
          const className = absolute < progress.position ? 'typed' : absolute === progress.position ? (wrong ? 'mistake' : 'current') : '';
          return <span key={absolute} className={className}>{letter}</span>;
        })}
      </div>
      <div className="sprint-input-row">
        <input ref={inputRef} className={'sprint-input' + (wrong ? ' is-wrong' : '')}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          inputMode="text" aria-label="Хурдны шалгалтын бичих талбар"
          placeholder={finalScore ? 'Шалгалт дууслаа' : 'Энд дарж бичиж эхлээрэй…'}
          disabled={!!finalScore} onChange={handleInput}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={event => {
            composing.current = false;
            const value = event.currentTarget.value;
            event.currentTarget.value = '';
            accept(value);
          }}
          onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}/>
        <button type="button" className="sprint-reset" onClick={() => reset()}>↻ <span>Шинэчлэх</span></button>
      </div>
      <p className="sprint-input-hint">Монгол гарын байрлал · Ө, Ү болон цэг тэмдэгтийг зөв бичнэ · Paste тооцогдохгүй</p>
    </section>
    <div className="sprint-metrics" aria-label="Бичих үзүүлэлт">
      <div><span>ХУРД</span><strong>{currentWpm} <small>WPM</small></strong></div>
      <div><span>НАРИЙВЧЛАЛ</span><strong>{currentAccuracy}%</strong></div>
      <div><span>ЗӨВ ТЭМДЭГТ</span><strong>{progress.position}</strong></div>
      <div><span>{daily ? 'ӨНӨӨДРИЙН РЕКОРД' : duration + ' СЕК РЕКОРД'}</span><strong>{best} <small>WPM</small></strong></div>
    </div>
    {finalScore && <section className="sprint-result" role="status" aria-label="Шалгалтын үр дүн" data-testid="sprint-result">
      <div><span>{finalScore.newBest ? 'ШИНЭ ХУВИЙН РЕКОРД' : 'ТАНЫ ҮР ДҮН'}</span>
        <h2>{finalScore.wpm} <small>WPM</small></h2>
        <p>{finalScore.accuracy}% нарийвчлал · {finalScore.correct} зөв тэмдэгт · {finalScore.mistakes} алдаа</p></div>
      <div className="sprint-result-actions">
        <button type="button" className="sprint-again" onClick={() => reset()}>↻ ДАХИН ОРОЛДОХ</button>
        <button type="button" className="sprint-share" onClick={() => void share()}>ҮР ДҮН ХУВААЛЦАХ</button>
      </div>
      {shareMessage && <p className="sprint-share-feedback">{shareMessage}</p>}
      <small className="sprint-unranked">Энэ нь төхөөрөмж дээр хадгалсан дасгалын дүн. Албан ёсны ranking болон шагналд тооцогдохгүй.</small>
    </section>}
  </div>;
}
