import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent, useLayoutEffect } from 'react';
import { accuracyPercent, characters, wordsPerMinute, type TypingProgress } from '@typeracer/shared';
import { applyLocalKey, INITIAL_LOCAL_PROGRESS, type LocalProgress } from './typingSync';
import { readRaceClock, type ServerClock } from './useRaceStart';
import { currentWordRange } from './raceView';


type Props = {
  text: string;
  /** Source story title and sentence range, so the racer knows what they are reading. */
  title?: string;
  part?: string;
  prediction?: TypingProgress | null;
  syncing?: boolean;
  enabled: boolean;
  available: boolean;
  /** The racer already crossed the finish line; the passage stays as a record. */
  finished?: boolean;
  /** The race is over for everyone (or this racer timed out) without a finish. */
  ended?: boolean;
  rank?: number | null;
  canAcceptKey: () => boolean;
  clock: ServerClock | null;
  serverProgress: number;
  serverStrokes: number;
  serverMistakes: number;
  startedAt: number | null;
  sendKey: (key: string) => boolean;
};

/**
 * The typing caret never waits for WebSocket echoes. Local feedback is immediate;
 * the server still validates every individual key and alone decides race results.
 * Mount with key={matchId} to reset local state between races.
 */
export const QuickTypingPanel = memo(function QuickTypingPanel({
  text, title, part, prediction, syncing, enabled, available, finished, ended, rank, canAcceptKey, clock,
  serverProgress, serverStrokes, serverMistakes, startedAt, sendKey
}: Props) {
  const letters = useMemo(() => characters(text), [text]);
  const inputRef = useRef<HTMLInputElement>(null);
  const phraseRef = useRef<HTMLDivElement>(null);
  const compositionBeforeStart = useRef(false);
  const localRef = useRef<LocalProgress>({ ...INITIAL_LOCAL_PROGRESS });
  const [local, setLocal] = useState<LocalProgress>(INITIAL_LOCAL_PROGRESS);
  const [now, setNow] = useState(() => readRaceClock(clock));

  useEffect(() => {
    if (!enabled) return;
    // Touch browsers need a user tap to open the keyboard. Keep an already
    // focused preparation input mounted/focused when the light turns green.
    if (document.activeElement !== inputRef.current && !window.matchMedia('(pointer: coarse)').matches)
      inputRef.current?.focus({ preventScroll: true });
  }, [enabled]);

  useEffect(() => {
    if (prediction) { localRef.current = prediction; setLocal(prediction); }
  }, [prediction]);

  // Only the server can move the confirmed finish line. If a snapshot is ahead
  // (e.g. after an interrupted frame), catch up without rolling the caret back
  // during normal WebSocket latency.
  useEffect(() => {
    if (prediction || serverProgress <= localRef.current.progress) return;
    const next = {
      progress: serverProgress,
      strokes: Math.max(localRef.current.strokes, serverStrokes),
      mistakes: Math.max(localRef.current.mistakes, serverMistakes),
      wrong: false
    };
    localRef.current = next;
    setLocal(next);
  }, [prediction, serverProgress, serverStrokes, serverMistakes]);

  useEffect(() => {
    if (!enabled) return;
    setNow(readRaceClock(clock));
    const id = window.setInterval(() => setNow(readRaceClock(clock)), 250);
    return () => window.clearInterval(id);
  }, [enabled, clock]);

  function acceptInput(value: string) {
    // Pasting, dropping multi-character strings and disconnected sends cannot move the caret.
    const previous = localRef.current;
    const next = applyLocalKey(previous, text, value, canAcceptKey(), sendKey);
    if (next === previous) return;
    localRef.current = next;
    setLocal(next);
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    if ((event.nativeEvent as InputEvent).isComposing) return;
    const input = event.currentTarget;
    const value = input.value;
    input.value = '';
    acceptInput(value);
  }

  const shown = prediction?.progress ?? Math.max(serverProgress, local.progress);
  const wrong = (prediction?.wrong ?? local.wrong) && enabled;
  const [wordStart, wordEnd] = useMemo(() => currentWordRange(letters, shown), [letters, shown]);
  useLayoutEffect(() => {
    const phrase = phraseRef.current;
    const cursor = phrase?.children[shown] as HTMLElement | undefined;
    if (!phrase || !cursor) return;
    // Scroll only the bounded passage, never the page or the Android keyboard.
    const line = cursor.getBoundingClientRect();
    const box = phrase.getBoundingClientRect();
    if (line.bottom > box.bottom || line.top < box.top) {
      phrase.scrollTop += line.top - box.top;
    }
  }, [shown]);
  const strokes = prediction?.strokes ?? Math.max(serverStrokes, local.strokes);
  const mistakes = prediction?.mistakes ?? Math.max(serverMistakes, local.mistakes);
  const seconds = startedAt ? Math.max(1, now - startedAt) : 1;
  const wpm = startedAt ? wordsPerMinute(shown, Math.max(1000, seconds)) : 0;
  const accuracy = accuracyPercent(Math.max(0, strokes - mistakes), strokes);
  const complete = shown >= letters.length;
  const over = finished || complete || ended;

  return <section className={'quick-type-panel'+(enabled ? ' active' : ' prepare')+(finished || complete ? ' done' : '')} data-testid="quick-type-panel"
    aria-label="Монгол хэлээр бичих текст">
    <div className="quick-type-head">
      <strong>{finished || complete ? '✓ БАРИАНД ОРЛОО' : ended ? 'ХУГАЦАА ДУУССАН' : enabled ? 'ОДОО БИЧЭЭРЭЙ' : 'УРАЛДААНЫ ТЕКСТ · УНШИЖ БЭЛДЭЭРЭЙ'}</strong>
      {title && <em className="quick-type-source" title="Энэ уралдааны текст аль өгүүллэгээс авсан бэ">«{title}»{part ? ' · ' + part : ''}</em>}
      <span>{shown} / {letters.length} тэмдэгт</span>
    </div>
    <div ref={phraseRef} className="quick-phrase" role="group" aria-label="Бичих текст" onClick={() => { if (available) inputRef.current?.focus(); }}>
      {letters.map((letter, i) => {
        const classes: string[] = [];
        if (i < shown) classes.push('typed');
        else if (i === shown) classes.push(wrong ? 'incorrect' : 'cursor');
        if (enabled && i >= wordStart && i < wordEnd && i >= shown) classes.push('word');
        return <span key={i} className={classes.length ? classes.join(' ') : undefined}>{letter}</span>;
      })}
    </div>
    <input ref={inputRef} className={'quick-type-input'+(wrong ? ' wrong' : '')} aria-label="Шууд уралдааны бичих талбар"
      autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
      inputMode="text" disabled={!available} data-race-enabled={enabled} onChange={onInput}
      aria-describedby="quick-keyboard-hint" aria-invalid={wrong || undefined}
      onCompositionStart={() => { compositionBeforeStart.current = !canAcceptKey(); }}
      onCompositionEnd={event => {
        const value = event.currentTarget.value;
        event.currentTarget.value = '';
        if (!compositionBeforeStart.current) acceptInput(value);
        compositionBeforeStart.current = false;
      }}
      onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
      placeholder={finished || complete ? 'Барианд орлоо!' : ended ? 'Уралдаан дууслаа' : enabled ? 'Энд бичиж эхлээрэй...' : 'Энд дарж keyboard-оо бэлдээрэй'} />
    {syncing && <p className="quick-sync-note" role="status">Холболт удаан байна. Бичсэн үсгийг баталгаажуулж байна…</p>}
    {enabled || over ? <div className="quick-metrics">
      <div title="Зөв тэмдэгт ÷ 5 ÷ минут. Эхний секундэд жигдрүүлж харуулна."><b>{wpm}</b><small>ҮГ/МИН</small></div>
      <div title="Зөв оролдлого ÷ бүх оролдлого. Алдаа зассан ч өмнөх алдаа тооцогдоно."><b>{accuracy}%</b><small>НАРИЙВЧЛАЛ</small></div>
      <div><b>{(seconds / 1000).toFixed(1)}s</b><small>ХУГАЦАА</small></div>
      <div className="quick-metric-rank"><b>{rank ? '#' + rank : '—'}</b><small>БАЙР</small></div>
    </div> : <p className="quick-ready-hint" id="quick-keyboard-hint">Энд дарж keyboard-оо нээгээрэй. Ногоон гэрэл асахаас өмнөх бичилт тооцогдохгүй.</p>}
  </section>;
});
