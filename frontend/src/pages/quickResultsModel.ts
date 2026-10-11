import { characters, progressPercent, type Racer, type RoomSnapshot } from '@typeracer/shared';

export type QuickResult = {
  type: 'quick-result'; raceId: string; place: number | null; coins: number;
  wpm: number; accuracy: number; elapsedMs: number; verified: false;
  standings?: Racer[];
};
export type QuickRaceOutcome = {
  result: QuickResult;
  snapshot: RoomSnapshot;
  playerId: string;
  at: number;
};
export type Standing = {
  player: Racer;
  position: number;
  progress: number;
  finished: boolean;
  percent: number;
};

/** Completed racers rank by actual server finish timestamp. Unfinished racers
 * follow in progress order and are never claimed as officially finished.
 * The player's own server result remains the authoritative awarded place.
 */
export function raceStandings(outcome: QuickRaceOutcome): Standing[] {
  const racers = outcome.result.standings ?? outcome.snapshot.players;
  const length = characters(outcome.snapshot.prompt.text).length;
  const normalized = racers.map(player => {
    const selfFinished = player.id === outcome.playerId && outcome.result.place !== null;
    const progress = selfFinished ? length : player.progress;
    const completedAt = selfFinished && player.completedAt === null
      ? (outcome.snapshot.startAt ?? outcome.at) + outcome.result.elapsedMs : player.completedAt;
    return {
      player: { ...player, progress, completedAt }, progress,
      finished: completedAt !== null, percent: progressPercent(progress, outcome.snapshot.prompt.text)
    };
  });
  normalized.sort((a,b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) {
      const gap = (a.player.completedAt ?? 0) - (b.player.completedAt ?? 0);
      if (gap !== 0) return gap;
    }
    return b.progress - a.progress || a.player.id.localeCompare(b.player.id);
  });
  return normalized.map((item,index) => ({ ...item, position: index + 1 }));
}
