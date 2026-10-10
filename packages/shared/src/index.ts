export type Language = 'mn' | 'en';
export type Prompt = { id: string; language: Language; text: string };
export type RacePhase = 'waiting' | 'countdown' | 'racing' | 'finished';
export type Racer = {
  id: string;
  name: string;
  progress: number;
  mistakes: number;
  strokes: number;
  ready: boolean;
  completedAt: number | null;
};
export type RoomSnapshot = {
  type: 'state';
  phase: RacePhase;
  prompt: Prompt;
  players: Racer[];
  startAt: number | null;
  durationMs: number;
};
export const ROOM_CAPACITY = 6;
export const RACE_DURATION_MS = 90_000;

/** Practice corpus: original Mongolian phrases (no scraped copyrighted texts). */
export const PROMPTS: Record<Language, Prompt[]> = {
  mn: [
    { id: 'mn-1', language: 'mn', text: 'Монгол хэлний зөв бичих дүрмийг өдөр бүр дасгал хийж сайжруулна.' },
    { id: 'mn-2', language: 'mn', text: 'Өглөөний нар уулын оройгоос мандаж, хотын гудамжийг гэрэлтүүлэв.' },
    { id: 'mn-3', language: 'mn', text: 'Үүлс нүүж, өргөн талын салхи өвсний үзүүрийг зөөлөн хөдөлгөнө.' },
    { id: 'mn-4', language: 'mn', text: 'Бүтээлч хүмүүс шинэ санаагаа хуваалцаж, хамтдаа хөгжин дэвшдэг.' },
    { id: 'mn-5', language: 'mn', text: 'Хурдан бичихээс илүүтэй алдаагүй, тогтвортой бичиж сурах нь чухал.' },
    { id: 'mn-6', language: 'mn', text: 'Улаанбаатарын өвөл хүйтэн боловч хүмүүс халуун дулаан сэтгэлтэй.' },
    { id: 'mn-7', language: 'mn', text: 'Сурагчид номын санд цугларч, мэдлэгээ өргөжүүлэхээр хичээж байна.' },
    { id: 'mn-8', language: 'mn', text: 'Гэрэл гэгээтэй ирээдүйн төлөө өнөөдөр нэг шинэ зүйл сурцгаая.' }
  ],
  en: [
    { id: 'en-1', language: 'en', text: 'Practice makes progress when you stay focused on every keystroke.' },
    { id: 'en-2', language: 'en', text: 'Fast racers build good habits before they chase a personal record.' },
    { id: 'en-3', language: 'en', text: 'Small improvements each day can turn a beginner into a champion.' }
  ]
};
export const normalizeText = (value: string): string => value.normalize('NFC');
export const characters = (value: string): string[] => Array.from(normalizeText(value));
export const accuracyPercent = (correct: number, total: number): number =>
  total === 0 ? 100 : Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
export const wordsPerMinute = (correctCharacters: number, elapsedMs: number): number =>
  elapsedMs <= 0 ? 0 : Math.max(0, Math.round(correctCharacters / 5 / (elapsedMs / 60_000)));
export const choosePrompt = (language: Language, randomValue = Math.random()): Prompt => {
  const list = PROMPTS[language];
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(randomValue * list.length)))];
};
export const progressPercent = (correctCharacters: number, text: string): number =>
  Math.min(100, Math.round((correctCharacters / characters(text).length) * 100));
