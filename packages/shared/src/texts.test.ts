import { describe, expect, it } from 'vitest';
import {
  STORIES, WORDS, generatePassage, passageCount, passageWindows, seededRandom,
  RACE_TEXT_MAX, RACE_TEXT_MIN, WORDS_TEXT_MAX, WORDS_TEXT_MIN
} from './texts';

const length = (text: string) => Array.from(text.normalize('NFC')).length;

describe('original story corpus', () => {
  it('has clean, NFC, sentence-sized Mongolian lines with unique ids and titles', () => {
    expect(STORIES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(STORIES.map(story => story.id)).size).toBe(STORIES.length);
    expect(new Set(STORIES.map(story => story.title)).size).toBe(STORIES.length);
    for (const story of STORIES) {
      expect(story.sentences.length).toBeGreaterThanOrEqual(6);
      for (const sentence of story.sentences) {
        expect(sentence, story.id).toBe(sentence.normalize('NFC'));
        expect(sentence, story.id).toBe(sentence.trim());
        expect(sentence, story.id).not.toMatch(/\s{2,}| /);
        expect(sentence, story.id).toMatch(/[.!?]$/);
        expect(length(sentence), story.id + ': ' + sentence).toBeGreaterThanOrEqual(35);
        expect(length(sentence), story.id + ': ' + sentence).toBeLessThanOrEqual(110);
        expect(sentence, story.id).toMatch(/^[А-ЯӨҮЁ]/u);
      }
    }
  });
  it('offers hundreds of distinct coherent passages inside the race budget', () => {
    const windows = passageWindows();
    expect(passageCount()).toBeGreaterThan(150);
    expect(new Set(windows.map(window => window.text)).size).toBe(windows.length);
    for (const window of windows) {
      expect(length(window.text)).toBeGreaterThanOrEqual(RACE_TEXT_MIN);
      expect(length(window.text)).toBeLessThanOrEqual(RACE_TEXT_MAX);
      expect(window.text).toMatch(/[ӨөҮү]/);
      // Consecutive sentences of one story: context is preserved.
      expect(window.story.sentences.slice(window.start, window.start + window.count).join(' ')).toBe(window.text);
    }
    expect(new Set(windows.map(window => window.story.id)).size).toBe(STORIES.length);
  });
});

describe('generatePassage', () => {
  it('is deterministic per seed and varied across seeds', () => {
    expect(generatePassage({ seed: 42 })).toEqual(generatePassage({ seed: 42 }));
    const texts = new Set(Array.from({ length: 40 }, (_, seed) => generatePassage({ seed }).text));
    expect(texts.size).toBeGreaterThan(25);
    const draws = Array.from({ length: 5 }, seededRandom(9));
    expect(draws.every(value => value >= 0 && value < 1)).toBe(true);
  });
  it('labels story passages with the story title and sentence range', () => {
    const passage = generatePassage({ seed: 3 });
    const story = STORIES.find(item => item.title === passage.title)!;
    expect(story).toBeDefined();
    expect(passage.mode).toBe('story');
    expect(passage.id).toMatch(new RegExp('^mn-' + story.id + '-\\d+-\\d+$'));
    expect(passage.part).toMatch(new RegExp('^\\d+(–\\d+)?/' + story.sentences.length + '$'));
    expect(passage.words).toBe(passage.text.split(' ').length);
    expect(passage.language).toBe('mn');
  });
  it('never repeats the excluded text or its story on a rematch', () => {
    for (let seed = 0; seed < 60; seed++) {
      const first = generatePassage({ seed });
      const next = generatePassage({ seed: seed + 1000, exclude: first.text });
      expect(next.text).not.toBe(first.text);
      expect(next.title).not.toBe(first.title);
      expect(next.id).not.toBe(first.id);
    }
  });
  it('generates random-words practice text inside its budget using only listed words', () => {
    for (let seed = 0; seed < 30; seed++) {
      const passage = generatePassage({ mode: 'words', seed });
      expect(passage.mode).toBe('words');
      expect(length(passage.text)).toBeGreaterThanOrEqual(WORDS_TEXT_MIN);
      expect(length(passage.text)).toBeLessThanOrEqual(WORDS_TEXT_MAX);
      expect(passage.text).toMatch(/[ӨөҮү]/);
      expect(passage.text).not.toMatch(/\s{2,}/);
      const rebuilt: string[] = [];
      let rest = passage.text;
      while (rest.length) {
        const word = WORDS.filter(candidate => rest === candidate || rest.startsWith(candidate + ' '))
          .sort((a, b) => b.length - a.length)[0];
        expect(word, 'unknown word at: ' + rest.slice(0, 20)).toBeDefined();
        rebuilt.push(word);
        rest = rest.slice(word.length + 1);
      }
      expect(rebuilt.length).toBe(passage.words);
    }
    expect(generatePassage({ mode: 'words', seed: 1 })).toEqual(generatePassage({ mode: 'words', seed: 1 }));
  });
  it('falls back to the default budget when a custom budget matches nothing', () => {
    const passage = generatePassage({ seed: 5, min: 5000, max: 6000 });
    expect(length(passage.text)).toBeLessThanOrEqual(RACE_TEXT_MAX);
  });
});
