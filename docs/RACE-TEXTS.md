# Race text generation

Races no longer draw from a short fixed list of sentences. Every public race, friend room and solo practice run gets a **generated passage** from `packages/shared/src/texts.ts`, which both the Worker (Durable Object) and the browser import.

## Story mode (default)

- The corpus is a set of **original Mongolian short stories** (22 stories, 8 sentences each), written for this game. No third-party or scraped text is used.
- A passage is a run of **consecutive sentences from one story**, so the text has context: the same characters, place and action continue from sentence to sentence, the way a real paragraph reads.
- The generator enumerates every sentence window whose NFC length is within `RACE_TEXT_MIN`–`RACE_TEXT_MAX` (130–205 characters) and contains at least one Ө/Ү. That pool is currently well over 150 distinct passages; adding a story adds roughly eight more.
- Each prompt carries `title` (story title) and `part` (sentence range such as `3–4/8`). The race page, the solo page and the results page show them, so players always know what they are reading.
- Public quick races never repeat the previous passage; a friend-room rematch always switches to a different story.

## Words mode

`generatePassage({ mode: 'words' })` builds a Monkeytype-style line of common Mongolian words (the `WORDS` list, ~230 entries) inside the same size budget. Solo practice exposes it as the **ҮГС** toggle next to **ӨГҮҮЛЛЭГ**.

## Determinism and API

- `generatePassage({ seed })` is deterministic (mulberry32), so a seed reproduces a passage exactly. Without a seed the selection is random.
- `GET /api/texts?mode=story|words&seed=N` returns `{ prompt, passages }` for tools and tests. `GET /api/prompts` still returns the legacy sentence list used by the hosted smoke test.
- `RACE_DURATION_MS` is now 120 s so a 25 WPM typist can finish the longest passage; the slowest roster bot (39 WPM) finishes in about 65 s.

## Adding content

Append a story to `STORIES` with a unique `id` and `title`, 6–10 sentences of 35–110 characters each, written in NFC Cyrillic and ending in punctuation. `npm test -w packages/shared` checks all of that and the passage pool.
