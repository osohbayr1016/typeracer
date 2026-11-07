import { wordsPerMinute, type Racer } from '@typeracer/shared';

type Lane = Pick<Racer, 'id' | 'progress' | 'completedAt'>;

/** Live words-per-minute for any lane from server progress and the shared race clock.
 * A one-second floor keeps the first keystrokes from showing absurd speeds. */
export function laneWpm(player: Pick<Racer, 'progress' | 'completedAt'>, startAt: number | null | undefined, now: number): number {
  if (startAt == null) return 0;
  const end = player.completedAt ?? now;
  return wordsPerMinute(player.progress, Math.max(1000, end - startAt));
}

/** Finish position by server completion time, null while still racing.
 * Ties break by id exactly like the server's placement. */
export function finishPlace(player: Lane, players: Lane[]): number | null {
  if (player.completedAt === null) return null;
  const at = player.completedAt;
  return 1 + players.filter(p => p.id !== player.id && p.completedAt !== null &&
    (p.completedAt < at || (p.completedAt === at && p.id < player.id))).length;
}

/** Standing during the race: more progress ranks higher; equal progress goes to the earlier finisher. */
export function liveRank(player: Lane, players: Lane[]): number {
  return 1 + players.filter(p => p.id !== player.id && (p.progress > player.progress ||
    (p.progress === player.progress && p.completedAt !== null &&
      (player.completedAt === null || p.completedAt < player.completedAt)))).length;
}

/** [start, end) of the word around the caret, so the passage can underline the current word.
 * A caret sitting on the space after a word still belongs to that word. */
export function currentWordRange(letters: readonly string[], caret: number): [number, number] {
  const space = (index: number) => index >= 0 && index < letters.length && /\s/u.test(letters[index]);
  let start = Math.max(0, Math.min(caret, letters.length));
  while (start > 0 && !space(start - 1)) start--;
  let end = Math.max(0, Math.min(caret, letters.length));
  while (end < letters.length && !space(end)) end++;
  return [start, end];
}

/** Mongolian ordinal label for a finishing place. */
export function placeLabel(place: number): string {
  return place + '-р';
}
