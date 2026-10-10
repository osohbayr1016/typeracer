import { characters } from '@typeracer/shared';

/** Accept a single Unicode character. The server owns the text and timing. */
export function acceptKeystroke(
  prompt: string,
  progress: number,
  mistakes: number,
  strokes: number,
  key: unknown
): { progress: number; mistakes: number; strokes: number } {
  if (typeof key !== 'string' || characters(key).length !== 1 || /[\u0000-\u001f\u007f]/u.test(key)) {
    return { progress, mistakes, strokes };
  }
  const expected = characters(prompt);
  if (progress >= expected.length) return { progress, mistakes, strokes };
  const correct = characters(key)[0] === expected[progress];
  return {
    progress: progress + Number(correct),
    mistakes: mistakes + Number(!correct),
    strokes: strokes + 1
  };
}
export function safePlayerName(input: string): string {
  return input.normalize('NFC').trim().replace(/[^\p{L}\p{N}_ .-]/gu, '').slice(0, 20) || 'Зочин';
}
export function validRoomCode(code: string): boolean { return /^[A-F0-9]{8}$/.test(code); }
