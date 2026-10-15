import { START_LIGHT_MS, type RoomSnapshot } from '@typeracer/shared';

/** The server-announced deadline drives the lights, even when a phase packet is late. */
export type StartSignal = 'off' | 'red' | 'yellow' | 'green';
export function startSignal(phase: RoomSnapshot['phase'] | undefined, startAt: number | null | undefined, now: number): StartSignal {
  if (phase !== 'countdown' && phase !== 'racing') return 'off';
  if (startAt === null || startAt === undefined) return phase === 'countdown' ? 'red' : 'off';
  if (now < startAt - START_LIGHT_MS) return 'red';
  if (now < startAt) return 'yellow';
  if (now < startAt + START_LIGHT_MS) return 'green';
  return 'off';
}
export function raceCanType(phase: RoomSnapshot['phase'] | undefined, startAt: number | null | undefined, now: number): boolean {
  return (phase === 'countdown' || phase === 'racing') && startAt != null && now >= startAt;
}
