# Phase 2 · Human-vs-human Beta integrity

## Implemented in Wave 4
- Public queue remains casual: humans plus clearly labeled bots; a lone person can always race.
- At the actual server-controlled green light, the server records how many humans are still in the match. Only races that **start with at least two actual human sessions** qualify as human-vs-human beta events.
- Original weekly points continue to count in casual results. For qualifying finished racers, an additive `leaderboard_pvp_races` SQL ledger references the original immutable `(race_id,player_id)` event. Clients cannot claim PvP on requests.
- `/api/leaderboard?mode=pvp` filters to those events; the default `mode=all` remains backwards-compatible. Old races are **not** backfilled as PvP when their original human count was not recorded.
- Restart-safe match checkpoints include `humanCountAtStart`; unknown historical snapshots conservatively default to zero.
- The UI calls the new board *Human vs Human · Beta*, never a fraud-proof official rating or verified cash-prize tournament.

## Not yet production-ranked safe
OAuth identity alone does not prove a unique human. Cross-device free XP/coins are still browser-local. The current key rate limiter and maximum believable WPM threshold are not complete automation detection. Require additional signed race input evidence, independent abuse review, challenge moderation, audited server-side rewards, skill calibration, anti-boosting, reliability/load testing, and appeals before creating a ranked MMR tier or money prize.

## Wave 5 — Fair queue and atomic score records

- Public matchmaking retains the complete five-second human arrival window. Robots visibly fill empty lanes but do not start the countdown early. Five real human players may start immediately. A new human displaces a bot while the queue is open.
- PvP beta eligibility is calculated when green lights start: at least two **online, distinct** human accounts. Disconnected racers in their reconnect grace window, and multiple tabs on the same account, cannot manufacture extra human opponents.
- `RaceRankingStore.record` accepts the Durable Object's synchronous SQLite transaction boundary; race event, PvP qualification row, and cached account aggregates commit or roll back together.
- A real SQLite regression test injects a write failure after race insertion, confirms rollback, then confirms a clean idempotent retry.
- Navigation labels paid coins and device-local earned coins separately; they still have separate ledgers. Linked-account status labels are shown accurately in the weekly board.
- Neither these changes nor guest sessions establish prize-safe ranked anti-cheat or authoritative free XP/coins. Those remain separate required tasks.
