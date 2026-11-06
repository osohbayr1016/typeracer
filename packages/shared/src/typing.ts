export type TypingProgress = { progress: number; strokes: number; mistakes: number; wrong: boolean };
export type InputAcknowledgement = {
  type: 'input-ack'; matchId: string; seq: number; progress: number; strokes: number; mistakes: number; wrong?: boolean;
};
export function typingKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.normalize('NFC');
  return Array.from(key).length === 1 && !/[\u0000-\u001f\u007f]/u.test(key) ? key : null;
}
/** One scoring rule for the prediction and server, with cached NFC prompt characters. */
export function advanceTyping(letters: readonly string[], previous: TypingProgress, value: unknown): TypingProgress {
  const key = typingKey(value);
  if (key === null || previous.progress >= letters.length) return previous;
  const correct = key === letters[previous.progress];
  return { progress: previous.progress + Number(correct), strokes: previous.strokes + 1,
    mistakes: previous.mistakes + Number(!correct), wrong: !correct };
}
