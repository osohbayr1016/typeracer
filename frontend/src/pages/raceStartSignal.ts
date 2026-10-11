import type { RoomSnapshot } from '@typeracer/shared';

/** Visual lights only: server phase, not local timer, grants permission to type. */
export type StartSignal = 'off' | 'red' | 'yellow' | 'green';
export function startSignal(phase: RoomSnapshot['phase'] | undefined, startAt: number | null | undefined, now: number): StartSignal {
  if (phase === 'countdown') {
    if (!startAt) return 'red';
    return startAt - now > 2_000 ? 'red' : 'yellow';
  }
  if (phase === 'racing' && startAt !== null && startAt !== undefined && now - startAt < 950)
    return 'green';
  return 'off';
}
