import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { accuracyPercent, characters, wordsPerMinute } from '@typeracer/shared';
import { applyLocalKey, INITIAL_LOCAL_PROGRESS, type LocalProgress } from './typingSync';


type Props = {
  text: string;
  enabled: boolean;
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
  text, enabled, serverProgress, serverStrokes, serverMistakes, startedAt, sendKey
}: Props) {
  const letters = useMemo(() => characters(text), [text]);
  const inputRef = useRef<HTMLInputElement>(null);
  const phraseRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<LocalProgress>({ ...INITIAL_LOCAL_PROGRESS });
  const [local, setLocal] = useState<LocalProgress>(INITIAL_LOCAL_PROGRESS);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [enabled]);

  // Only the server can move the confirmed finish line. If a snapshot is ahead
  // (e.g. after an interrupted frame), catch up without rolling the caret back
  // during normal WebSocket latency.
  useEffect(() => {
    if (serverProgress <= localRef.current.progress) return;
    const next = {
      progress: serverProgress,
      strokes: Math.max(localRef.current.strokes, serverStrokes),
      mistakes: Math.max(localRef.current.mistakes, serverMistakes),
      wrong: false
    };
    localRef.current = next;
    setLocal(next);
  }, [serverProgress, serverStrokes, serverMistakes]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [enabled]);

  function acceptInput(value: string) {
    // Pasting, dropping multi-character strings and disconnected sends cannot move the caret.
    const previous = localRef.current;
    const next = applyLocalKey(previous, text, value, enabled, sendKey);
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

  const shown = Math.max(serverProgress, local.progress);
  useEffect(() => {
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
  const strokes = Math.max(serverStrokes, local.strokes);
  const mistakes = Math.max(serverMistakes, local.mistakes);
  const seconds = startedAt ? Math.max(1, now - startedAt) : 1;
  const wpm = startedAt ? wordsPerMinute(shown, seconds) : 0;
  const accuracy = accuracyPercent(Math.max(0, strokes - mistakes), strokes);

  return <section className={'quick-type-panel'+(enabled ? ' active' : ' prepare')} data-testid="quick-type-panel"
    aria-label="Монгол хэлээр бичих текст">
    <div className="quick-type-head">
      <strong>{enabled ? 'ОДОО БИЧЭЭРЭЙ' : 'УРАЛДААНЫ ТЕКСТ · УНШИЖ БЭЛДЭЭРЭЙ'}</strong>
      <span>{shown} / {letters.length} тэмдэгт</span>
    </div>
    <div ref={phraseRef} className="quick-phrase" role="group" aria-label="Бичих текст" onClick={() => { if (enabled) inputRef.current?.focus(); }}>
      {letters.map((letter, i) => <span key={i}
        className={i < shown ? 'typed' : i === shown ? (local.wrong && enabled ? 'incorrect' : 'cursor') : undefined}>
        {letter === ' ' ? '\u00a0' : letter}
      </span>)}
    </div>
    <input ref={inputRef} className="quick-type-input" aria-label="Шууд уралдааны бичих талбар"
      autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
      inputMode="text" disabled={!enabled} onChange={onInput}
      onCompositionEnd={event => {
        const value = event.currentTarget.value;
        event.currentTarget.value = '';
        acceptInput(value);
      }}
      onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
      placeholder={enabled ? 'Энд бичиж эхлээрэй...' : 'Гараа эхлэхээр энд бичнэ...'} />
    {enabled ? <div className="quick-metrics">
      <div><b>{wpm}</b><small>ҮГ/МИН</small></div>
      <div><b>{accuracy}%</b><small>НАРИЙВЧЛАЛ</small></div>
      <div><b>{(seconds / 1000).toFixed(1)}s</b><small>ХУГАЦАА</small></div>
    </div> : <p className="quick-ready-hint">Уралдааны үгээ урьдчилж хараарай. Гараа эхлэхэд бичих талбар идэвхжинэ.</p>}
  </section>;
});
