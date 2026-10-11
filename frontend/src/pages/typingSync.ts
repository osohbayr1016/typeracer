import { characters } from '@typeracer/shared';

export type LocalProgress = { progress: number; strokes: number; mistakes: number; wrong: boolean };
export const INITIAL_LOCAL_PROGRESS: LocalProgress = { progress: 0, strokes: 0, mistakes: 0, wrong: false };

/** Optimistically advance only if the socket accepted a single keystroke for sending.
 * This is UI feedback, not an authoritative race score or delivery acknowledgement.
 */
export function applyLocalKey(
  previous: LocalProgress, text: string, value: string, enabled: boolean,
  sendKey: (key: string) => boolean
): LocalProgress {
  const pressed = characters(value);
  const length = characters(text).length;
  if (!enabled || pressed.length !== 1 || previous.progress >= length) return previous;
  const key = pressed[0];
  if (!sendKey(key)) return previous;
  const correct = key === characters(text)[previous.progress];
  return {
    progress: previous.progress + Number(correct),
    strokes: previous.strokes + 1,
    mistakes: previous.mistakes + Number(!correct),
    wrong: !correct
  };
}

/** WebSocket.OPEN is 1. Keeping the socket structural makes disconnect tests browser-free. */
export function sendRaceKey(
  socket: { readyState: number; send: (message: string) => void } | null, key: string
): boolean {
  if (!socket || socket.readyState !== 1) return false;
  try { socket.send(JSON.stringify({ type: 'key', key })); return true; }
  catch { return false; }
}
