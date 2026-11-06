import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent, useLayoutEffect } from 'react';
import { accuracyPercent, characters, wordsPerMinute, type TypingProgress } from '@typeracer/shared';
import { applyLocalKey, INITIAL_LOCAL_PROGRESS, type LocalProgress } from './typingSync';
import { readRaceClock, type ServerClock } from './useRaceStart';


type Props = {
  text: string;
  prediction?: TypingProgress | null;
  syncing?: boolean;
  enabled: boolean;
  available: boolean;
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
  text, prediction, syncing, enabled, available, canAcceptKey, clock, serverProgress, serverStrokes, serverMistakes, startedAt, sendKey
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

  return <section className={'quick-type-panel'+(enabled ? ' active' : ' prepare')} data-testid="quick-type-panel"
    aria-label="Монгол хэлээр бичих текст">
    <div className="quick-type-head">
      <strong>{enabled ? 'ОДОО БИЧЭЭРЭЙ' : 'УРАЛДААНЫ ТЕКСТ · УНШИЖ БЭЛДЭЭРЭЙ'}</strong>
      <span>{shown} / {letters.length} тэмдэгт</span>
    </div>
    <div ref={phraseRef} className="quick-phrase" role="group" aria-label="Бичих текст" onClick={() => { if (available) inputRef.current?.focus(); }}>
      {letters.map((letter, i) => <span key={i}
        className={i < shown ? 'typed' : i === shown ? ((prediction?.wrong ?? local.wrong) && enabled ? 'incorrect' : 'cursor') : undefined}>
        {letter}
      </span>)}
    </div>
    <input ref={inputRef} className="quick-type-input" aria-label="Шууд уралдааны бичих талбар"
      autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
      inputMode="text" disabled={!available} data-race-enabled={enabled} onChange={onInput}
      aria-describedby="quick-keyboard-hint"
      onCompositionStart={() => { compositionBeforeStart.current = !canAcceptKey(); }}
      onCompositionEnd={event => {
        const value = event.currentTarget.value;
        event.currentTarget.value = '';
        if (!compositionBeforeStart.current) acceptInput(value);
        compositionBeforeStart.current = false;
      }}
      onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
      placeholder={enabled ? 'Энд бичиж эхлээрэй...' : 'Энд дарж keyboard-оо бэлдээрэй'} />
    {syncing && <p className="quick-sync-note" role="status">Холболт удаан байна. Бичсэн үсгийг баталгаажуулж байна…</p>}
    {enabled ? <div className="quick-metrics">
      <div title="Зөв тэмдэгт ÷ 5 ÷ минут. Эхний секундэд жигдрүүлж харуулна."><b>{wpm}</b><small>ҮГ/МИН</small></div>
      <div title="Зөв оролдлого ÷ бүх оролдлого. Алдаа зассан ч өмнөх алдаа тооцогдоно."><b>{accuracy}%</b><small>НАРИЙВЧЛАЛ</small></div>
      <div><b>{(seconds / 1000).toFixed(1)}s</b><small>ХУГАЦАА</small></div>
    </div> : <p className="quick-ready-hint" id="quick-keyboard-hint">Энд дарж keyboard-оо нээгээрэй. Ногоон гэрэл асахаас өмнөх бичилт тооцогдохгүй.</p>}
  </section>;
});
