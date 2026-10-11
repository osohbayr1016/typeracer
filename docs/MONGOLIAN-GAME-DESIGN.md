# TypeRacer Mongolia — game-loop, cosmetics, and competitive roadmap

## Research (official Nitro Type materials, read 2026-10-11)
This project borrows **interaction principles**, not Nitro Type branding, gameplay artwork, vehicle likenesses, proprietary code, or assets.

- Nitro Type's 2026 season releases emphasize race-to-XP progression, free and membership loot, collectible cars, titles, trails, stickers and a player-controlled claims journey. https://www.nitrotype.com/news/read/281/welcome-to-vista-valley and https://www.nitrotype.com/news/read/280/nitro-arcade-volume-3-is-here
- The customizer supports independently equipped trails; an option can hide season effects without losing progress. https://www.nitrotype.com/news/read/223/heads-up-trails-are-here and https://www.nitrotype.com/news/read/278/new-feature-season-perk-visibility-toggle
- The shop separates featured and timed inventory. https://www.nitrotype.com/news/read/284/the-shop-is-getting-a-major-restock and https://www.nitrotype.com/news/read/219/announcing-the-item-shop
- Private friend races include an invite-based waiting lobby and race transitions; the official 2023 overhaul describes customizable settings. https://www.nitrotype.com/news/read/250/friend-race-overhaul--more
- Nitro Type moved from broad leaderboards to weekly groups of 30, league tiers and weekly promotion/demotion partly to address cheating and inclusiveness. https://www.nitrotype.com/news/read/266/introducing-leagues-a-new-era-of-competition

## TypeRacer Mongolia product positioning
1. **Language:** Only Mongolian Cyrillic race prompts and Mongolian-first UI; include Ө, Ү, punctuation and authentic locally authored prose.
2. **Loop:** Home → choose mode → countdown → correct typing → WPM/accuracy/result → XP/coins → season claim → shop/garage → replay.
3. **Collection:** Eleven original visual car choices, four named trail styles, three collectible stickers, and named achievement-style titles. Free starter vehicles remain available.
4. **Season:** Эхний гараа: 2026-10-01 to 2026-11-30 Mongolia local time. Eight deterministic free tiers. No randomized loot.
5. **Shop:** Fixed-price coin purchases, ownership checks, ability to equip after purchase, no paid currency or subscription.
6. **User honesty:** Browser-local XP is editable and cannot count as publicly verified race results or money.

## Implemented v1 (safe guest mode)
- `frontend/src/progression.ts`: immutable data transformations for awarding a completed solo race, buying a known item, equipping only owned items and claiming an eligible unclaimed season tier.
- `frontend/src/pages/ShopPage.tsx`, `SeasonPage.tsx`, `GaragePage.tsx`: functional collection pages.
- `frontend/public/cars/*.svg`: six original vectors for shop or season reward cars.
- `frontend/src/App.tsx`: route wiring, XP/coin persistence and race equipped cosmetics.
- `packages/shared/src/index.ts`: expanded original Mongolian prompt corpus.
- E2E tests exercise race → rewards, purchasing → equipping, one-time claims, reload persistence, lobby and asset delivery.

## Production-grade fair competitive phase (NOT IMPLEMENTED)
1. **Accounts and identity:** Cloudflare-compatible OAuth/session auth, anti-CSRF, consent, account ownership and privacy requirements. Username moderation and abuse management.
2. **Authoritative ledgers:** D1 migrations for `users`, `race_sessions`, `race_events`, `race_results`, `wallet_ledger`, `inventory`, `season_definitions`, `season_claims`, `league_entries`, `matchmaking_queue`; atomic transactions/idempotency keys, immutable audit records. Never treat localStorage as the canonical balance.
3. **Fair racing:** Server issues signed per-race challenge, controls countdown, receives and validates batched keystroke events, caps unphysical rates with human-review/appeals, computes trusted WPM/accuracy and records verified finish only. WebSocket reconnect/idempotent replay guards.
4. **Skill competition:** Region-aware public casual matchmaking; skill-based queues based on verified WPM/accuracy, placement calibration and clear reconnect/time-out behavior. Friend rooms remain separate.
5. **Leagues:** Weekly small group cohorts, promotion/demotion based on verified completed races with minimum sample sizes; anti-smurfing and anti-boosting. Avoid cash/prizes until fraud prevention is independently reviewed.
6. **Seasons:** Persist claimed tiers per `(user_id, season_id, tier_id)` as unique DB constraints; server-computed XP only, no early-claim via clock manipulation; optional future paid pass would need payment compliance, server receipts and consumer protection.
7. **Scale and reliability:** Durable Object for each race; sharded matchmaking, controlled fanout, load tests, tracing, latency SLO, WAF edge throttles, budget alarms, auto-recovery and abuse dashboards.
8. **Mongolian corpus fairness:** Per-prompt metrics, standardized length/difficulty, normalized Unicode, separate calibrated leaderboards, strong duplicate elimination, accessibility and keyboard-layout guidance.

## Deployment and acceptance
- Change is staged via PR with automated TypeScript/build/unit/Playwright tests.
- On approval and successful merge, GitHub Actions deploys Cloudflare staging and runs a **real two-socket live smoke test**.
- Visual QA still requires checking desktop, tablet, Android, iPhone, real Mongolian keyboards, reduced-motion settings and car asset legibility.

## Asset ownership
Vehicle SVGs are independently authored original illustrations for TypeRacer Mongolia. Do not import Nitro Type vehicle art or style-specific copyrighted graphics. User-facing visual references are inspiration only.
