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

/** Guest results are server-computed but not anti-cheat verified; never advertise
 * them as official records or imply that the daily link is the same race. */
export function quickResultShareText(outcome: QuickRaceOutcome, nickname: string, challengeUrl: string): string {
  const player = nickname.trim().slice(0, 20) || 'Тоглогч';
  const { place, wpm, accuracy } = outcome.result;
  const placing = place !== null ? '#' + place + ' байр' : 'барианд ороогүй';
  return player + ' · TypeRacer Mongolia: ' + placing + ', ' + wpm + ' WPM, ' + accuracy +
    '% нарийвчлал (зочны тоглолт, албан ёсны rank биш).\n' +
    'Надтай 30 секундийн Монгол typing challenge-д өрсөлдөөрэй: ' + challengeUrl;
}
