import { describe, it, expect } from 'vitest';
import { acceptKeystroke, safePlayerName, validRoomCode } from './logic';
import { characters } from '@typeracer/shared';
describe('authoritative key scoring', () => {
  it('accepts Mongolian characters and rejects wrong characters', () => {
    const first = acceptKeystroke('Өвөл', 0, 0, 0, 'Ө');
    expect(first).toEqual({ progress: 1, mistakes: 0, strokes: 1 });
    expect(acceptKeystroke('Өвөл', 1, 0, 1, 'x')).toEqual({ progress: 1, mistakes: 1, strokes: 2 });
  });
  it('scores cached Unicode characters identically across a wrong key and retry', () => {
    const sentence='Өвөл үүл';
    const letters=characters(sentence);
    let progress=0, mistakes=0, strokes=0;
    for (const key of ['Ө','x','в','ө','л',' ','ү','ү','л']) {
      const cached=acceptKeystroke(letters,progress,mistakes,strokes,key);
      const raw=acceptKeystroke(sentence,progress,mistakes,strokes,key);
      expect(cached).toEqual(raw);
      ({progress,mistakes,strokes}=cached);
    }
    expect(progress).toBe(letters.length);
    expect(mistakes).toBe(1);
  });
  it('does not accept pasted strings or control keys', () => {
    expect(acceptKeystroke('сайн', 0, 0, 0, 'сайн').progress).toBe(0);
    expect(acceptKeystroke('сайн', 0, 0, 0, 'Enter').progress).toBe(0);
  });
  it('validates identifiers and cleans names', () => {
    expect(validRoomCode('A9B101CA')).toBe(true);
    expect(validRoomCode('abc')).toBe(false);
    expect(safePlayerName('<script>')).not.toContain('<');
  });
});
