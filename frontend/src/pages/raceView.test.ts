import { describe, expect, it } from 'vitest';
import { currentWordRange, finishPlace, laneWpm, liveRank, placeLabel } from './raceView';

const lane = (id: string, progress: number, completedAt: number | null) => ({ id, progress, completedAt });

describe('lane telemetry', () => {
  it('computes live WPM from server progress with a one-second floor', () => {
    expect(laneWpm({ progress: 50, completedAt: null }, 10_000, 70_000)).toBe(10);
    expect(laneWpm({ progress: 50, completedAt: 40_000 }, 10_000, 99_000)).toBe(20);
    expect(laneWpm({ progress: 5, completedAt: null }, 10_000, 10_050)).toBe(60);
    expect(laneWpm({ progress: 5, completedAt: null }, null, 10_050)).toBe(0);
  });
  it('orders finishers by completion time and breaks ties like the server', () => {
    const players = [lane('me', 100, 5000), lane('fast', 100, 4000), lane('slow', 60, null), lane('tie', 100, 5000)];
    expect(finishPlace(players[0], players)).toBe(2);
    expect(finishPlace(players[1], players)).toBe(1);
    expect(finishPlace(players[2], players)).toBeNull();
    expect(finishPlace(players[3], players)).toBe(3);
  });
  it('ranks live standings by progress, then by earlier finish', () => {
    const players = [lane('a', 40, null), lane('b', 90, null), lane('c', 100, 3000), lane('d', 100, 2000)];
    expect(liveRank(players[0], players)).toBe(4);
    expect(liveRank(players[1], players)).toBe(3);
    expect(liveRank(players[2], players)).toBe(2);
    expect(liveRank(players[3], players)).toBe(1);
  });
  it('labels places in Mongolian', () => {
    expect(placeLabel(1)).toBe('1-р');
  });
});

describe('currentWordRange', () => {
  const letters = Array.from('Өвөл хүйтэн.');
  it('finds the word around the caret', () => {
    expect(currentWordRange(letters, 0)).toEqual([0, 4]);
    expect(currentWordRange(letters, 2)).toEqual([0, 4]);
    expect(currentWordRange(letters, 5)).toEqual([5, 12]);
    expect(currentWordRange(letters, 11)).toEqual([5, 12]);
  });
  it('keeps a caret on the trailing space with the finished word', () => {
    expect(currentWordRange(letters, 4)).toEqual([0, 4]);
  });
  it('handles the end of the passage and empty input', () => {
    expect(currentWordRange(letters, 12)).toEqual([5, 12]);
    expect(currentWordRange(letters, 99)).toEqual([5, 12]);
    expect(currentWordRange([], 0)).toEqual([0, 0]);
  });
});
