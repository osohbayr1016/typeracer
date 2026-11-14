# TypeRacer Mongolia — playable staging beta

**Commerce update:** Wire/QPay coin packs, a one-time cosmetic Supporter bundle, account recovery and reliable sequenced race input are implemented. See [monetization and racing](docs/MONETIZATION-AND-RACING.md) for the current offers, test commands and remaining beta boundaries.

A Mongolian Cyrillic typing-race game, built with the same main stack as the author's `standoff-` project: **TypeScript, npm workspaces, React + Vite, Hono, Cloudflare Workers, Durable Objects and WebSockets**.

**Status:** Playable Cloudflare staging beta with live Quick Race, invite-only private rooms, server-owned earned XP/coins, persistent season rewards, daily and weekly beta leaderboards, plus a separate protected paid-wallet ledger. Offline Sprint/Daily practice continues to use device-local stats. This is **not** certified as production-ranked, tournament/prize-safe, or live merchant-verified. See [the required production go-live checklist](docs/PRODUCTION-GO-LIVE.md) before enabling a public paid launch.

## Features available now

- Mongolian-only typing races on **generated passages**: consecutive sentences cut from 22 original Mongolian short stories (so every text has context), plus a Monkeytype-style random-words mode for solo practice. WPM, accuracy and personal best. See [docs/RACE-TEXTS.md](docs/RACE-TEXTS.md).
- Browser-local practice XP, earned coins, fixed-price cosmetics store, 29 original vehicle skins in the starter, season and earned shop catalog, equipped trails/titles/stickers and an eight-tier free seasonal reward pass.
- Friend-only guest rooms, 2–6 players, 8-character invite code, Ready, countdown and real-time race progress.
- Server-computed race progress, per-socket abuse limits and same-origin browser API protection.
- TypeScript, unit/SQLite integrity tests, native Cloudflare Worker runtime and a broad Chromium browser E2E suite; on `main`, the current staging pipeline also runs a live multiplayer WebSocket smoke test.
- **Completed online Quick Races** mint account-bound earned XP/coins only from server-approved race events; daily quests and rotating season claims are transactional. Device-local Sprint/Daily practice remains explicitly separate and cannot mint online balances. Purchased coins, supporter grants and paid debits use a distinct protected receipt ledger.
- One Cloudflare Worker hosts **both the game website and /api endpoints**, so no separate Cloudflare Pages deployment or CORS environment variables are needed.

**Not yet certified:** prize tournaments, identity-proof ranked MMR, advanced anti-cheat, production-scale latency/load, live cross-device OAuth and merchant settlement/refund QA. Public and private race reconnect checkpoints, account sessions, signed payment receipts and the server-owned free economy have automated coverage, but live hardware/merchant acceptance remains external.

## Try it locally

Requires Node.js **22+** and npm **11.6.2**.

```bash
git clone https://github.com/osohbayr1016/typeracer.git
cd typeracer
npm install -g npm@11.6.2
npm install
```

Start these in **two terminals** at the repository root:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open **http://localhost:5173**. Solo play works without the API; multiplayer requires the Worker on port 8787.

To test with a friend locally: select **Найзуудтай уралдах**, create a room in browser A, enter the code in browser B, press **БЭЛЭН БОЛОХ** in both, and type after the three-second countdown. Browsers on different computers should use the deployed staging site instead.

## Production deployment and release gate

The `main` workflow deploys **staging only**. Production uses an isolated Worker and its own SQLite Durable Object namespace, with an explicitly confirmed manual GitHub workflow and a production environment approval. Follow [Production go-live](docs/PRODUCTION-GO-LIVE.md) before attempting a production rollout. Staging users/orders are **not** automatically copied to production.

## Deploy to Cloudflare: easiest manual staging route

A **single Worker** deploys both the frontend files and the server API, including the Durable Object migration. The Worker will be called `mongolian-typeracer-staging`. Do **not** deploy the work-in-progress branch to a production custom domain.

1. Create or sign in to your [Cloudflare dashboard](https://dash.cloudflare.com/). Enable the `workers.dev` subdomain for your account if prompted. Make sure your account supports **Durable Objects**.
2. In your local clone, log in with `npx wrangler login`. Complete the browser authentication.
3. Build the frontend, then deploy the Worker:

```bash
npm run build -w frontend
npm run deploy -w backend
```

4. Wrangler prints your **actual public URL** (for example, `https://mongolian-typeracer-staging.<your-subdomain>.workers.dev`). Do not guess the subdomain.
5. Smoke-test the published site using Node 22:

```bash
node scripts/smoke.mjs https://mongolian-typeracer-staging.<your-subdomain>.workers.dev
```

The smoke test validates the HTML site, API health, Mongolian prompts, creation of a real Durable Object room, and a WebSocket connection. If deployment fails, check Cloudflare API permissions/account eligibility and the GitHub Actions logs; a successful dry-run is **not** proof of a successful live deployment.

## Deploy to Cloudflare automatically via GitHub Actions

The CI workflow verifies typechecks, unit tests, build and browser tests. On a **push to `main`**, a subsequent staging job will deploy the site only when both Cloudflare credentials are configured. You can also deploy without another commit using the **Run workflow** button on GitHub Actions (choose main) after adding the secrets.

1. In Cloudflare dashboard, locate your **Account ID** (not Zone ID). Create an account-scoped API token with permissions sufficient to deploy/create Workers and their Durable Objects, scoped to your intended account only.
2. In [this repo's GitHub Actions secrets settings](https://github.com/osohbayr1016/typeracer/settings/secrets/actions), create:
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
   - `CLOUDFLARE_API_TOKEN` — limited-scope Cloudflare API token.
3. **Never paste the token into code, README, issues, PR descriptions, chat, or a public environment variable.**
4. Open [GitHub Actions](https://github.com/osohbayr1016/typeracer/actions), select **Verify and deploy Cloudflare staging**, and choose **Run workflow → main**. This triggers verification and deployment without any additional Git commit.
5. Check [GitHub Actions](https://github.com/osohbayr1016/typeracer/actions) for the **Deploy Cloudflare staging after tests** job. On success, its job summary contains the public URL and a hosted smoke-test result.
6. If the job says credentials are missing, no deployment occurred. Use **Run workflow → main** after adding secrets; no commit is needed. The live smoke test now connects two WebSockets, readies both players, observes synchronized start, types five characters and verifies the other client receives progress.

**No Cloudflare API token is in the repository.** Configuration lives in `backend/wrangler.jsonc`, and `frontend/dist` is built and uploaded as static assets in the same release. `VITE_API_URL` is intentionally left unset for same-origin requests.

## Run tests before shipping

```bash
npm run typecheck
npm test
npm run build
npm run build:worker -w backend
npm run test:runtime
npx playwright install chromium
npm run test:e2e
```

Manual acceptance checklist:

- Solo typing: Mongolian Ө/Ү only, corrections, restart, WPM and accuracy. Verify shop purchases, one-time season claims and equipped cosmetics across reload.
- Two devices: create room, join with code, Ready/countdown, correct/wrong keys, completion.
- Mobile browser and desktop keyboards; verify input methods, focus and orientation.
- Close one player's tab while waiting/racing and observe room behavior.
- Verify random invented room codes are rejected, room caps and origin policy.
- Run `node scripts/smoke.mjs <published-https-url>` after each release.

## Game progression / collection

The currently active free season is **Эхний гараа** (2026-10-01 to 2026-11-30, Mongolia time). Race-earned XP unlocks fixed tiers; players explicitly claim rewards. Each completed solo race earns device-local XP and coins, with deterministic item purchases. This is playable guest mode—not secure for ranked, paid, or transferable assets. See [game design / competitive roadmap](docs/MONGOLIAN-GAME-DESIGN.md).

## Security, reliability and limits

- Room codes are public invitation codes, **not passwords**. Browser same-origin checks help with cross-site requests but are not authentication and don't stop scripts or bots.
- Private rooms and public Quick Races persist serializable race checkpoints to SQLite Durable Objects and support a short token-based reconnect window. WebSockets and timers are reconstructed on resume; this is not yet a full hibernation/load-tested guarantee for high-stakes play.
- Room creation, checkout and recovery have shared SQLite-backed abuse-limit counters in the coordinator Durable Object. Cloudflare WAF/bot mitigation and load testing remain required before a public paid launch.
- Browser localStorage practice stats are manipulable and cannot qualify for prizes; completed account-linked Quick Races are written to server ledgers, but the competitive anti-cheat assurance is still beta.
- D1 migration in `backend/migrations` is only a future scaffold. **No D1 binding/migration and no paid R2 storage are required for this beta.**
- Before real-money public competition: validate live OAuth/account-recovery and Wire settlement/refund workflows, implement moderation, account deletion/data exports and privacy requirements where applicable, strengthen anti-cheat and operations telemetry, test sustained load/p95 latency, and retain manual production release approvals.

The experience is original; external typing games inspire interaction patterns but no third-party copyrighted game code/assets are copied.
