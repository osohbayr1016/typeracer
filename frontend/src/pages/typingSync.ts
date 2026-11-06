import { characters, advanceTyping, typingKey } from '@typeracer/shared';

export type LocalProgress = { progress: number; strokes: number; mistakes: number; wrong: boolean };
export const INITIAL_LOCAL_PROGRESS: LocalProgress = { progress: 0, strokes: 0, mistakes: 0, wrong: false };

/** Optimistically advance only if the socket accepted a single keystroke for sending.
 * This is UI feedback, not an authoritative race score or delivery acknowledgement.
 */
export function applyLocalKey(
  previous: LocalProgress, text: string, value: string, enabled: boolean,
  sendKey: (key: string) => boolean
): LocalProgress {
  const key = typingKey(value);
  const letters = characters(text);
  if (!enabled || key === null || previous.progress >= letters.length) return previous;
  if (!sendKey(key)) return previous;
  return advanceTyping(letters, previous, key);
}

/** WebSocket.OPEN is 1. Keeping the socket structural makes disconnect tests browser-free. */
export function sendRaceKey(
  socket: { readyState: number; send: (message: string) => void } | null, key: string
): boolean {
  if (!socket || socket.readyState !== 1) return false;
  try { socket.send(JSON.stringify({ type: 'key', key })); return true; }
  catch { return false; }
}
