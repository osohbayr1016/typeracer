## 2026-10-11 — Six rarity tiers, 18 original shop cars and level-aware future content

**User clarified scope:** requested **5–8 rarity tiers**, *not* 5–8 cars. Implemented **6 distinct tiers with 3 new original car skins each** (18 assets), rather than a single flat set of 8 cars. Eight starter illustrations were already created on this feature branch; ten additional original SVGs complete the six families.

**Changes:** `frontend/public/cars/` (18 new self-contained, editable SVG car illustrations); `frontend/src/pages/cars.ts` (full collection IDs and tier/effect metadata); `frontend/src/progression.ts` (level-gated in-game-coin purchases and deterministic Featured/Daily spotlight selection); `frontend/src/pages/ShopPage.tsx` and `ShopPage.css` (shopfront, rarity filters, independent cards/animations); `GaragePage.tsx` and `GaragePage.css` (rarity-aware owned/equipped car displays); `backend/src/quick.ts` and `room.ts` (server cosmetics allowlist); unit and E2E tests; `docs/SHOP-COLLECTION-GUIDE.md` (safe future content playbook).

**Critical test gates:** Shop six filter tiers, 18 served SVGs, level lock with ample coins, no double-purchases, garage persistence, mobile overflow, and server allowlist for real multiplayer. Run typecheck/unit/build/E2E and confirm Cloudflare staging smoke after low-risk merge; never claim tested before checks pass.

**Upcoming scheduled cycle:** Existing hourly automation should inspect code/CI first. No more than once daily, if appropriate and tested, add at most 1–2 original car skins or non-car cosmetics to balanced rarity/XP tiers; do not flood the shop hourly with unreviewed output, and do not invent player usage statistics.

**Known risk:** All virtual coins and ownership remain locally stored; do not market premium purchases, trading or leaderboard-verified assets until server wallet/auth exists.

---

# TypeRacer Mongolia — continuous improvement handoff

Purpose: a short factual log for the next hourly cycle. Update only after checking the repository's current state and GitHub Actions; do not assume this document is current.

## 2026-10-11 — Public race fits one screen; five-player limit and clear race start

**User-reported issue / confirmed code diagnosis:** Public match was set to 10 lanes (`backend/src/quick.ts`), 10 large car rows competed with the typing passage for viewport space, and the UI showed a numeric waiting timer as well as a separate 3-second start countdown. At typical laptop sizes the passage/input could be below the fold. Nitro Type's regular track commonly uses five racers.

**Scoped fix:** Public quick matches now contain exactly 5 total human/bot racers. The original unique Mongolian bot roster remains; up to 4 bots join one at a time, or real humans take slots. When the final slot fills, a single 3-2-1 start countdown begins. Waiting status instead displays 1/5–5/5 and a plain label, not another timer. A dedicated compact five-lane track with small 69px desktop/52px mobile vehicle graphics sits above the high-contrast typing passage and input. The oversized title and prize card no longer consume race screen height. Local instant typing feedback and server-validated placement are preserved; private custom rooms remain unchanged.

**Acceptance gate:** PR verification must pass TypeScript, unit, frontend/Worker build and Chromium E2E, including explicit no-scroll input bounds at 1366×768 and 390×844. After merge, staging must pass both public five-lane and private-room live WebSocket smoke tests. Do not claim manual physical-device QA or measured frame rates unless performed.

**Unchanged risks:** guest-local wallet, `verified:false` race results, no robust reconnect/hibernating DO, no measured p95 latency. Mobile IME and low-height devices should still receive manual QA. Next action after verification: test real-phone Cyrillic keyboard usability and track per-keystroke client-to-server acknowledgement, then improve disconnect handling.

---

## 2026-10-11 — Race responsiveness and progressive lobby (user-requested)

**Confirmed functional problem:** Public quick race `QuickRacePage.tsx` advanced typing highlights only from the server's 50ms-batched WebSocket snapshot, making each keystroke feel delayed. Text was hidden until after the 5s queue and 3s countdown. Bots were inserted together only when the timer ended. The 4–5 player queue looked artificial.

**Changes:** `frontend/src/pages/QuickTypingPanel.tsx` is a focused optimistic local caret/typo renderer: keystrokes display immediately while every individual key is still sent to server validation and the server still owns finish placement and prize. Race text renders above the track as soon as the queue provides its shared Mongolian prompt; focus activates when countdown ends. `backend/src/quick.ts` stages a unique name/car/pace bot roster into the lobby every 400ms, supports 10 racers total (up to 9 bots), lets incoming humans replace remaining bots before queue close, and fills all lanes before the countdown. `QuickRacePage.css` shrinks the 10 lanes and animates newcomer entrance. All bots are labeled **БОТ**. New unit, E2E and live staging smoke checks cover the new lobby shape and timing.

**Release verification:** PR CI and live Cloudflare deploy must be confirmed independently; do not claim the lag is resolved on all physical devices without manual typing checks, especially Mongolian IME on mobile, and do not claim any latency benchmark without measurements.

**Known limitations:** optimistic caret can briefly advance ahead of the confirmed server state on a high-latency connection, with server race-result authoritative. Prizes still browser-local and `verified:false`. Public matchmaking still uses a singleton in-memory Durable Object without resumable disconnects or scalable sharding. Friend rooms are intentionally unchanged.

**Next actions:** measure client-to-ack p50/p95; test real Mongolian mobile keyboards/composition; add reconnection/recovery and server-side authenticated reward ledger before any official ranking.

---

## 2026-10-11 — Cycle 1: public Quick Play release verification

**Baseline:** `main` commit `ad6e0c8278` adds real public quick matchmaking, server bots and guest race prizes. GitHub Actions [run 38113321972](https://github.com/osohbayr1016/typeracer/actions/runs/38113321972) finished successfully, including Cloudflare staging and its then-current private-room live smoke test.

**Confirmed release-test gap (P1):** `scripts/smoke.mjs` tested `/api/rooms/:code/ws` only; it never connected to `/api/quickplay/ws`, the endpoint behind the primary **Play** action. A staging deployment could therefore report success even if public queueing, bot fill, or public race synchronization had regressed. `e2e/game.spec.ts` already covers local public matchmaking; this fixes the separate **hosted staging verification** gap.

**Scoped change:** `scripts/smoke.mjs` now opens two real public WebSocket clients, checks same matchmaking ID and Mongolian prompt, waits for a synchronized public countdown, verifies at least four racing lanes (server-filled bots if humans are fewer than four), validates server-observed human keystrokes from the other socket, and requires a bot to advance if bots are present. Existing private-room smoke checks remain. `.github/workflows/ci.yml` syntax-checks the smoke script and labels the checks correctly. No game UI, engine, economy, migration, or production deployment changes.

**Verification and release status:** check the new PR's GitHub Actions (PR checks first). New public hosted smoke assertions execute **only after merge when the staging deployment runs**. Do not claim hosted public quickplay verification before that job actually succeeds. This PR is a test-only release safety improvement, not a new production-grade ranking or anti-cheat system.

**Open risks / suggested next priority:**
1. **P1 — fairness and abuse:** `backend/src/quick.ts` limits incoming keys to 35/s but does not provide strong proof of human typing. Server results are marked `verified:false`; `frontend/src/progression.ts` stores coins and XP in editable localStorage. Do not treat these as trusted rankings or sellable prizes.
2. **P1 — reconnect/reliability:** public matchmaking uses an in-memory singleton Durable Object and WebSocket connections without a durable reconnect/resume contract; analyze restart/eviction and disconnect behavior before scaling.
3. **P2 — release coverage:** staging smoke validates public queue/early live progress, not a complete public finish-and-reward cycle. Consider a non-destructive test isolated from real players and user wallets before extending live smoke.
4. **P2 — CI maintenance:** open Dependabot PRs #2–#8 require compatibility checks before independently merging; avoid dependency upgrades bundled with gameplay fixes.

**Rule for next cycle:** inspect newest `main`, open PRs and CI, and finish/repair this PR before starting another unrelated change. Keep production releases manual; allow only the existing staging workflow.
