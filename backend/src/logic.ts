import { characters, advanceTyping } from '@typeracer/shared';

/** Accept a single Unicode character. The server owns the text and timing. */
export function acceptKeystroke(
  prompt: string | readonly string[],
  progress: number,
  mistakes: number,
  strokes: number,
  key: unknown
): { progress: number; mistakes: number; strokes: number } {
  const letters=typeof prompt==='string' ? characters(prompt) : prompt;
  const next = advanceTyping(letters, { progress, mistakes, strokes, wrong: false }, key);
  return { progress: next.progress, mistakes: next.mistakes, strokes: next.strokes };
}
export function safePlayerName(input: string): string {
  return input.normalize('NFC').trim().replace(/[^\p{L}\p{N}_ .-]/gu, '').slice(0, 20) || 'Зочин';
}
export function validRoomCode(code: string): boolean { return /^[A-F0-9]{8}$/.test(code); }
