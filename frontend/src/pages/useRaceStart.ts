import { useEffect, useState } from 'react';
import { START_LIGHT_MS, type RoomSnapshot } from '@typeracer/shared';
import { raceCanType, startSignal } from './raceStartSignal';

export type ServerClock = { serverNow: number; receivedAt: number };
export const readRaceClock = (clock: ServerClock | null) => clock
  ? clock.serverNow + performance.now() - clock.receivedAt : Date.now();

/** Render at the three exact light boundaries, not the entire track every 200ms. */
export function useRaceStart(phase: RoomSnapshot['phase'] | undefined, startAt: number | null | undefined, clock: ServerClock | null) {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (startAt == null || (phase !== 'countdown' && phase !== 'racing')) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = readRaceClock(clock);
      const next = [startAt - START_LIGHT_MS, startAt, startAt + START_LIGHT_MS].find(t => t > now);
      if (next !== undefined) timer = setTimeout(() => { redraw(n => n + 1); schedule(); }, Math.max(1, next - now));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [phase, startAt, clock]);
  const now = readRaceClock(clock);
  return { signal: startSignal(phase, startAt, now), canType: raceCanType(phase, startAt, now) };
}
