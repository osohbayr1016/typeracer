import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { accuracyPercent, characters, wordsPerMinute } from '@typeracer/shared';

type LocalProgress = { progress: number; strokes: number; mistakes: number; wrong: boolean };
const INITIAL: LocalProgress = { progress: 0, strokes: 0, mistakes: 0, wrong: false };

type Props = {
  text: string;
  enabled: boolean;
  serverProgress: number;
  serverStrokes: number;
  serverMistakes: number;
  startedAt: number | null;
  sendKey: (key: string) => void;
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
  const localRef = useRef<LocalProgress>({ ...INITIAL });
  const [local, setLocal] = useState<LocalProgress>(INITIAL);
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
    // Pasting or dropping blocks of text must not grant several race characters.
    const pressed = characters(value);
    if (pressed.length !== 1 || !enabled || localRef.current.progress >= letters.length) return;
    const key = pressed[0];
    const previous = localRef.current;
    const correct = key === letters[previous.progress];
    const next: LocalProgress = {
      progress: previous.progress + Number(correct),
      strokes: previous.strokes + 1,
      mistakes: previous.mistakes + Number(!correct),
      wrong: !correct
    };
    localRef.current = next;
    setLocal(next); // instant UI update, not tied to the network broadcast
    sendKey(key);    // one event per actual key; server validates and scores
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    if ((event.nativeEvent as InputEvent).isComposing) return;
    const input = event.currentTarget;
    const value = input.value;
    input.value = '';
    acceptInput(value);
  }

  const shown = Math.max(serverProgress, local.progress);
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
    <div className="quick-phrase" role="group" aria-label="Бичих текст" onClick={() => { if (enabled) inputRef.current?.focus(); }}>
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
