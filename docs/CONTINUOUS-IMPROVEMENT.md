## 2026-10-11 — Public start lights + durable points and Team beta (PR #25)

**User screenshot:** public race displayed a plain top-right numeric countdown, whereas the expected visual is three centered start lamps (red, yellow, green). Added a track-centered CSS signal tied to **server** `phase/startAt`: red then yellow during countdown, green only when server phase becomes `racing`. The quick typing input remains disabled before green; motion preferences are honored. A Chromium E2E asserts center alignment and disabled/enabled gating.

**Global scoring request:** historical Nitro Type documentation (2016) publicly described speed/accuracy points, but the current proprietary algorithm is **not** reproducible. TypeRacer implements its own documented `round((90 + 0.75*WPM)*(accuracy/100)^2)`, requiring completed server-scored race, accuracy >=70%, WPM <=210. Points do not affect coins, XP, levels, or match placement. Bots and incomplete attempts never get points. Guest account cookie is HttpOnly/SameSite, Durable Object SQLite persists an idempotent `(race_id,player_id)` result ledger and weekly player leaderboard. `/api/leaderboard` allows paginated results with WPM, accuracy, races, points and Team tag; only completed humans with a guest session appear. The weekly cutoff is Monday UTC; total player stats persist.

**Teams:** guest beta can create one Team, invite via code (maximum 25 members), join via invite, see member breakdown and weekly Team board. Team points originate from server-written race events while in a Team. The current model is intentionally a **guest/beta competition**, not an authenticated global league; guest accounts can be reset or farmed and do not prove a person's identity. Team captain ownership transfer, anti-cheat, provider account login, session-token hashing, durable matchmaking after instance restart and abuse protection remain outstanding. Do not label as verified or launch prizes until those are implemented.

**Google and Facebook authentication:** must use real OAuth 2.0 app credentials, server-side state/CSRF protection, verified provider identity, secure session rotation and account linkage; no credentials/secrets are present in repo. Do NOT show fake working Google/Facebook buttons or claim integration is configured. Integrate as a separate reviewed security milestone and keep guest racing playable.

**Tests:** Vitest checks score fairness caps, UTC week boundaries, server-only start lights; Chromium checks centered lights and server-gated input, backend-written live ranking and two-browser Team join/persistence. **CI/staging remain to be verified**; no destructive migrations, paid dependencies or production deployment. Existing SQLite Durable Object classes only; additive `CREATE TABLE IF NOT EXISTS`.

---

## 2026-10-11 — PR #23 staging evidence and current P0–P3 backlog

**Completed previous priority:** [PR #23](https://github.com/osohbayr1016/typeracer/pull/23) is merged into `main` at `2eeb42d2`. Its behavioral closed/throwing WebSocket unit/Chromium tests, real local Worker resume tests, typecheck and build passed. [Main push run 38133888580](https://github.com/osohbayr1016/typeracer/actions/runs/38133888580) passed Cloudflare staging deployment and real public/private WebSocket smoke: two private clients synchronized, public queue joined two clients, bot and human progress was observed. This is CI smoke evidence, not a manual browser/device review.

**Current unfinished priority:** [PR #24](https://github.com/osohbayr1016/typeracer/pull/24) fixes the confirmed 71%-of-lane finish-line car display defect and replaces the verbose Play page with clear side-by-side public/friends options. Adds guest profile, stats, last-race/local-record leaderboard, friend room actions and post-race results. [PR run 38136164109](https://github.com/osohbayr1016/typeracer/actions/runs/38136164109) passed typecheck, unit, build, Chromium; PR staging skipped by design. Recheck CI after documentation changes, then merge only if green, then verify main staging smoke.

### Evidence-ranked open issues

| Priority | Area and evidence | Next test or fix |
|---|---|---|
| P0 | None confirmed in reviewed CI and staging runs. | Reassess on new failure evidence. |
| P1 | Guest economy and ranking: `progression.ts` persists coins/XP/ownership in localStorage; quick results are `verified:false`. | Authenticated server ledger before any official global rankings. |
| P1 | Public match memory: `backend/src/quick.ts` active race state is not durable across DO restart; 15s reconnect is same-instance only. | Persist/recover match state; restart E2E. |
| P1 | Fair play: quick WebSocket accepts up to 35 keys/s, bot-filled five-lane races; no stronger verification of human input. | Concurrent-join, race timing and bot fairness tests. |
| P1 fixed in #24 | 71%-of-track car geometry and text-heavy `/play`. | New-head CI and staging release gate; mobile visual review. |
| P2 | Mongolian mobile IME and optimistic typing: local send success is not server ACK; no p95 typing-latency measurement. | Composition tests and authoritative per-key reconciliation. |
| P2 | Resume/finish UX: disconnect under packet loss and page reload after a result are not durable/reproducible. | Network-shaping and reload recovery tests. |
| P2 | Mobile/accessibility: automated responsive overflow and reduced-motion checks exist, not physical-device, screen-reader or 200%-zoom QA. | Keyboard, zoom, contrast and real Mongolian IME QA. |
| P2 | Staging smoke validates public queue/progress, not a complete hosted race finish/reward. | Safe isolated end-to-end staging finish smoke. |
| P3 | Performance unmeasured; cosmetics six rarity tiers and 18 original SVG cars should remain unchanged while gameplay work is open. | Load profiling; handle dependency PRs independently. |

No production changes, migrations or new paid dependencies.

---

## 2026-10-11 — Race finish alignment, clean race entry and real player pages (PR pending)

**Confirmed on user's staging screenshot:** at reported 100% progress, the quick-race car graphic remained roughly one quarter track length behind the checkerboard despite a server-computed #1 finish and 120-coin reward. Root cause in `QuickRacePage.tsx`: `left: done * .71 + '%'` caps the car position at 71%; it is a *display geometry* bug, not proof of an incorrect server finish.

**Fix:** car left = progress percent, compensate with proportional full-car translation and 14px flag clearance, so front bumper reaches checkerboard when progress reaches 100. Race result still arrives only on the server's `quick-result`, with no client-generated prize. On result, navigate from crowded track to a dedicated compact post-race results screen: standings with explicit unfinished bots, verified outcome/coins, deduped device-local XP/season progress, claimable season rewards, idempotent daily quests, Mongolia-local streak, and Play Again/Home/Garage actions.

**User requested less text and obvious navigation:** replaced long `УРАЛДАХАД БЭЛЭН ҮҮ?` pitch and duplicate explanations with one compact Play heading and two full-width side-by-side choices (public quick match and friends private room, direct create/join code). Added navigable Profile, Stats, Leaderboard and Friends views with responsive styling and editable stored nickname. Profile and stats use real local race ledger; leaderboard shows the latest actual race and personal record rankings, NOT fabricated global users. Friends page creates/joins the existing real private WebSocket room; account friends/presence still require auth and storage.

**Research reference (principles only, not copied assets):** Nitro Type's current [leagues](https://www.nitrotype.com/leagues), [friends UX](https://www.nitrotype.com/friends/) and [May 2025 stats overhaul](https://www.nitrotype.com/updates) support concise actions and player-centric data; Nitro retired earlier global leaderboards. Keep six rarity tiers, existing shop catalog and gameplay/level fairness unchanged.

**Tests added/updated:** deterministic frontend Vitest race standings, Mongolia-local daily-quest/idempotent-claim/streak unit tests; Chromium E2E for race results and rewards, entry/friend choice, mobile layout, profile persistence, stats and leaderboard honesty. **Do not claim CI, staging, hosting, mobile host QA or production readiness until actual workflow results are inspected.** No destructive migrations, paid APIs or production changes. Remaining: authenticated public rankings, true friend accounts/presence, race anti-cheat/DB ledger, full DO persistence; users can see beta labeling.

---

## 2026-10-11 — PR #23 Chromium regression: ghost waiting racers

**Observed CI failure:** GitHub Actions run [38132361548](https://github.com/osohbayr1016/typeracer/actions/runs/38132361548) passed typecheck/unit/build but failed Chromium: three legacy bot-count checks observed 3 bots instead of 4 (or 1 instead of 3); the new reconnect browser test could not reach an editable input. Failure output: 24 passed, 4 failed. Root cause consistent with immediate React StrictMode WebSocket cleanup leaving a disconnected **waiting** participant reserved for 15 seconds, hence phantom occupied lanes and early countdown. This was introduced with reconnect grace, not pre-existing matchmaker behavior.

**Fix:** `backend/src/quick.ts` immediately evicts a disconnected **waiting**/finished racer (no typed progress to preserve), while retaining the 15-second reconnect grace only during countdown/racing. `backend/src/quick.reconnect.test.ts` verifies abandoned waiting sockets do not take bot slots, and moves token-expiry test to an in-progress match. Existing Chromium bot-count and live DO resume E2E remain required. **New CI run must be inspected before merge; this note is not a pass claim.** No staging/production change or new shop inventory.

---

## 2026-10-11 — Durable Object public-race realtime resume and sync (PR #23)

**Prior blocker fixed in code:** PR #23 typecheck failed because a source-text test imported `node:fs` and `node:url` without frontend Node types. Replace it with deterministic behavior tests of guarded WebSocket sends and Mongolian Cyrillic optimistic typing.

**Confirmed gap:** Existing Cloudflare SQLite-backed `RaceRoom` Durable Object routes public matches to a singleton `QuickMatchmaker`. A closed WebSocket deleted its human immediately and a reconnect created a NEW race with zero progress. This lost server-confirmed typing and race position.

**Changes on `fix/quickplay-no-phantom-typing`:** (1) Keep a disconnected public racer in its DO match for up to 15 seconds; (2) bind a cryptographically random short-lived per-tab resume token to the previous racer; (3) on reconnect reattach the socket to the same racer ID/match ID and send the authoritative DO snapshot immediately, including existing progress and later result if available; (4) mark temporarily disconnected racers in snapshots; (5) bounded browser auto-retry and manual fallback; (6) guard local optimistic typing against closed/throwing WebSocket sends. The token is NEVER broadcast in opponent snapshots. No ranked rewards or real-money economy changes.

**Test coverage added:** Backend simulated WebSocketPair/DO reconnect tests for session identity/progress/token isolation/expiry; frontend behavioral Vitest for Cyrillic typed/wrong characters, disabled/paste/closed/throwing sends; Chromium E2E for actual local Worker public race disconnect/rejoin preserving server progress and racer identity. **CI, live staging, browser behavior and PR merge are not confirmed until actual workflow logs are checked.** Existing workflows only; never production.

**Important limits:** QuickMatchmaker keeps active races in DO process memory, not SQLite: recovery works only while the DO instance remains alive, NOT after Durable Object eviction/restart. Per-tab resume token is an unverified guest bearer credential; browser WebSocket URL can appear in infrastructure logs and should not carry real account claims. No guaranteed message delivery or per-keystroke acknowledgement yet; transient optimistic vs authoritative progress may still diverge on rate-limited/rejected messages. Plan server sequenced ACK, reconnect hibernation/durable recovery, abuse bounds for queued disconnected players, and real-mobile Mongolian IME QA before production-scale claims.

---

## 2026-10-11 — Quick Play disconnected optimistic typing guard (PR pending)

**Confirmed code risk:** QuickTypingPanel advanced local progress before QuickRacePage checked WebSocket readiness. A closed socket or throwing send could show phantom typed characters.

**Branch:** `fix/quickplay-no-phantom-typing`. QuickRacePage sendKey now returns false when socket is not OPEN or send throws; QuickTypingPanel only advances its optimistic caret after send returns true. A successful send does not guarantee server receipt; server finish/results remain authoritative. Added focused source regression tests. **Tests/CI and staging not yet verified; do not merge before required checks pass.** No new shop content added because gameplay reliability has priority. Follow up with actual browser disconnect E2E and reconciliation on reconnect.

---

## 2026-10-11 — Critical cosmetic silhouette UX correction (Shop)

**Confirmed user-visible issue:** Screenshot from the live staging Shop shows the six Mythic/Legendary vehicles as the same copied spiked wedge body with color changes; neighboring lower-rarity cars are similarly repeated. Earlier generated photorealistic concept renders are also predominantly a single hypercar archetype, so blindly uploading that existing ZIP would not fix the underlying vehicle diversity. The original PR #21 made artwork detailed but failed this visual distinctiveness requirement.

**Reference researched:** Nitro Type's Shop and official September 2026 restock announcement have Featured/Daily selections, collectible variation and prices. Historical dealership categories include offroad/trucks, motorbikes, race cars, flying and novelty vehicles. This is inspiration only; no licensed Nitro Type visuals, model files or exact car identity are copied.

**Implementation:** Replace the 18 same-body collection SVGs with **18 separately drawn body silhouettes and differing wheelbase/vehicle class** (rally coupe, 4×4, city hatch, drag muscle, open buggy, electric van, ice roadster, open-top sports car, long dragster, wheel-free stealth interceptor, six-wheel armored transport, open-wheel formula, steam locomotive, flying saucer, eagle wing racer, royal carriage, crystal six-wheel rover, fiery dragon hover vehicle). Keep their current Skin IDs, owned local profiles, six rarity levels, shop prices and public/private multiplayer references unchanged. Add explicit `modelType` to CarSkin, show it on collection cards and in enlarged accessible modal preview with true rarity/level/price/equip actions; mobile layouts and reduced-motion remain supported.

**Quality gates:** Tests check 18 distinct SVG `path` bodies, wheel counts 0/2/3, image load, inspect modal behavior/level rules/viewport, existing Shop buy/equip persistence, real multiplayer, and staging smoke. Do not merge until CI genuinely passes.

**Honest limitation:** The specific prior generated high-res PNG/WebP renders are *not* deployed as binary image assets through GitHub; this PR builds new self-contained original SVG illustrations with dramatically different vehicle classes. The app-stage URL is not accessible through the assistant's direct page-fetch tool, so browser-style QA relies on uploaded screenshot, source and Playwright CI. Never claim manual live browser inspection or uploaded raster originals.

---

## 2026-10-11 — Premium car artwork across all rarity tiers

**Confirmed issue:** The 18 collection car IDs had separate SVG files but the drawings shared similar flat, template-like proportions. The user requested different premium vehicle silhouettes and a higher-quality Nitro Type-inspired collector experience. The previous batch of photorealistic generated images remained separate from GitHub rather than being shipped as web assets.

**Change scope:** On branch `feat/all-rarity-premium-car-art`, replace the 18 existing collection SVG assets in `frontend/public/cars/` with distinct self-contained sculpted SVG designs (original car body geometry, gloss/glass, wheel/rim details, gradients and increasingly elaborate high-rarity decoration). Preserve 18 car IDs, exact shop catalog, rarity/level/price/ownership rules, existing private/public multiplayer allowlists and favorite saved car references. Improve rarity tab price/XP labels and card presentation. Add E2E checks for each SVG loading successfully, being nontrivial and containing unique main vehicle geometry.

**Release gate:** Verify GitHub CI typecheck, unit, build, Chromium plus live staging public/private WebSockets. Do not claim the high-res generated PNG files are hosted in GitHub: the **shipped website artwork is original vectorized interpretation**; high-res imagegen renders are separately available for further refinement. No production deploy or destructive changes.

**Outstanding risks:** Cosmetic localStorage economy is untrusted, true photo-level asset replacement still requires binary GitHub uploads and explicit art review, animation effects remain cosmetic and reduced-motion preferences honored. Prioritize critical gameplay bugs before future art updates.

---

## 2026-10-11 — Free Battle Pass UX rework with integrated rarity Shop

**Baseline:** shop rarity PR #19 is already merged on `main` (six tiers, 18 new original SVG skins, all permanent in the catalog). No duplicate skins added. Its latest main-branch CI and Cloudflare staging were green at the start of this session.

**Confirmed UX weakness:** `SeasonPage.tsx` treated all eight reward tiers as visually equal, with a bulky hero and no clear actionable "claimable now" summary. Players could not tell at a glance which XP target was next, how much XP remained, or how to collect multiple unlocked rewards.

**Scoped implementation:** `SeasonPage.tsx` + `SeasonPage.css` provide a compact status header, next claimable/locked reward spotlight, exact next-XP requirements, full-season progress, unlocked/claimed counts, one-click `claimAvailableRewards`, clear eight-stage roadmap and explicit "Race for XP" / "Shop (18 new cars)" routes. Navigation renamed to **Шагналын зам**. `progression.ts` adds deterministic `seasonProgress` and safe idempotent bulk claiming using the existing `claimReward` rules; tier thresholds, season dates, current owned items and stored player profiles are unchanged. Unit and E2E tests cover multiple rewards, mobile layout, shop link, reload persistence and expiry.

**Release gate:** PR verification must genuinely pass TypeScript, unit, frontend/Worker build and Playwright. After merge, existing staging deployment and live public/private WebSocket smoke must pass. No production deploy, payment flow or changes to server reward authority.

**Risk:** guest XP and ownership still saved in browser localStorage; this is a free cosmetic beta, not a verified account economy. Future improvement cycles should favor race fairness/reliability over expanding the shop. Manual real-device visual review still advised.

---

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
