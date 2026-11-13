# Phase 1 · Wave 1: fast typing and daily challenge

- `/sprint` is a one-click, solo 15/30/60-second practice mode. Timer starts on the first entered character; the typing cursor is local and does not wait for a WebSocket. Each wrong keystroke is counted but does not advance the caret. Paste/drop is refused and IME composition is handled as a single accepted character, not bulk input.
- `/daily` lasts 30 seconds. Players in the same Mongolian calendar day see the same deterministic generated story-passage sequence. Today's seed and content are derived from `Asia/Ulaanbaatar` midnight.
- Each practice duration has its own browser-local personal best; today's daily challenge also has its own browser-local best. No coins, XP, paid inventory, official leaderboard points or verified results are awarded.
- Players can share a practice result and a direct challenge link via native Share or clipboard. This is an invitation, not a signed/attested competitive score.

Test with `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` and physical Android/iPhone Mongolian keyboard QA. Manually test background tab throttling, focus, portrait keyboard and page refresh. No claims of server-authoritative scoring, cheat-proofing, multi-device recovery or completed device QA.
