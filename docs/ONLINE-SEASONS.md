# Online Seasons (Wave 11)

## Calendar and data ownership
- Season 01 starts 2026-10-01 00:00 in Asia/Ulaanbaatar and ends 2026-12-01 00:00. Its older device-local rewards and inventory remain unchanged; **do not** silently credit their mutable balances to the server.
- From Season 02 (2026-12-01), a new season starts on the first day of every second calendar month at midnight Ulaanbaatar. This continues into 2027 without redeploying a date constant.
- Server season XP is recomputed from accepted `earned_races` within the exact season start/end epoch timestamps. Old earned coins, permanent cosmetics, and lifetime XP stay owned across rotation.
- A `POST /api/progression/season/claim` request accepts only the tier number; it never accepts XP, item, or payout amounts. An authenticated player must have enough server XP.
- `earned_season_claims` uses (player_id, season_id, tier) as its primary key and is committed transactionally with item grants and the online coin balance. Retries cannot double-claim.
- Reward cosmetics are real SHOP catalog items; a player who already owns one gets **half its listed coin price** instead. This is a server-calculated consolation, not user-supplied.
- OAuth merges take a union of race events, cosmetics and seasonal claims; same-season duplicate claims pay once.
- Season 02+ are server-backed. Current Season 01 still uses its grandfathered browser-local pass, which must never be described as globally secure.

## User experience
- Direct /season links still work; the old pass remains visible until the Season 01 deadline.
- A server Season 02+ page uses the current account's XP, milestone statuses, owned rewards, and remaining calendar days.
- On focus/visibility change and while the Season page is open, the app refreshes its season clock and current server profile. A new day or season does not require manual deployment.
- Finishing an online race updates the profile; the result sidebar reflects Season 02+ progress.

## Coverage and operational limits
- DatabaseSync tests cover exact Mongolia midnight, 2027 rollover, race-window isolation, duplicate claims, shop grants, rollback, and OAuth dedup.
- Playwright tests check Season 01 continuity and responsive future-season UI with mocked future server state; these UI tests do not substitute for actual December live deployment QA.
- **Not prize-safe:** public Quick Race still has beta integrity signals; do not attach real-money prizes or prize-eligible ranked competition until anti-cheat and fraud review are complete.
