# TypeRacer Mongolia — continuous improvement handoff

Purpose: a short factual log for the next hourly cycle. Update only after checking the repository's current state and GitHub Actions; do not assume this document is current.

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
