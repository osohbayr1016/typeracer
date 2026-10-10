import { describe, expect, it } from 'vitest';
import { accuracyPercent, characters, choosePrompt, progressPercent, wordsPerMinute } from './index';
describe('language and scoring', () => {
  it('includes Mongolian Cyrillic specifics', () => {
    const text = choosePrompt('mn', 0.3).text;
    expect(text).toMatch(/[ӨөҮү]/);
    expect(characters('o\u0308').join('')).toBe('ö');
  });
  it('computes WPM and accuracy with safe zero denominators', () => {
    expect(wordsPerMinute(25, 60_000)).toBe(5);
    expect(wordsPerMinute(25, 0)).toBe(0);
    expect(accuracyPercent(0, 0)).toBe(100);
    expect(accuracyPercent(8, 10)).toBe(80);
  });
  it('caps progress', () => {
    expect(progressPercent(500, 'abc')).toBe(100);
  });
});
