import { accuracyPercent, advanceTyping, characters, generatePassage, wordsPerMinute } from '@typeracer/shared';

export const SPRINT_DURATIONS = [15, 30, 60] as const;
export type SprintDuration = typeof SPRINT_DURATIONS[number];
export type SprintProgress = { position: number; attempts: number; mistakes: number };
export const EMPTY_SPRINT: SprintProgress = { position: 0, attempts: 0, mistakes: 0 };

/** The date changes at midnight in Mongolia, not at the player's browser timezone. */
export function sprintDailyKey(at: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(at));
  const part = (name: string) => parts.find(x => x.type === name)?.value ?? '';
  return part('year') + '-' + part('month') + '-' + part('day');
}

/** A stable, reproducible challenge seed; this is NOT proof of a verified score. */
export function sprintSeed(day: string): number {
  let hash = 2166136261;
  for (const char of day) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A long enough original Cyrillic corpus for a full 60-second typing sprint. */
export function sprintText(seed: number): string {
  return Array.from({ length: 8 }, (_, index) =>
    generatePassage({ mode: 'story', seed: (seed + Math.imul(index, 0x9e3779b9)) >>> 0 }).text
  ).join(' ');
}

/** Single-character acceptance prevents a pasted string from earning progress. */
export function sprintAdvance(progress: SprintProgress, rawKey: string, text: string): SprintProgress {
  const next = advanceTyping(characters(text), {
    progress: progress.position, strokes: progress.attempts,
    mistakes: progress.mistakes, wrong: false
  }, rawKey);
  if (next.strokes === progress.attempts) return progress;
  return { position: next.progress, attempts: next.strokes, mistakes: next.mistakes };
}

export function sprintScore(progress: SprintProgress, elapsedMs: number) {
  return {
    wpm: wordsPerMinute(progress.position, Math.max(1, elapsedMs)),
    accuracy: accuracyPercent(Math.max(0, progress.attempts - progress.mistakes), progress.attempts),
    correct: progress.position,
    mistakes: progress.mistakes,
    elapsedMs: Math.max(1, elapsedMs)
  };
}
