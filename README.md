# TypeRacer Mongolia — playable staging beta

A Mongolian Cyrillic typing-race game, built with the same main stack as the author's `standoff-` project: **TypeScript, npm workspaces, React + Vite, Hono, Cloudflare Workers, Durable Objects and WebSockets**.

**Status:** Solo, friend-room races and device-local cosmetic progression work in development. This is a **staging/unranked beta**, not yet a ranked, payment-ready, or production-secure competition platform. All game code is on **main**; no pull request or merge step is needed.

## Features available now

- Mongolian-only typing practice with 48 original Cyrillic prompts including Ө/Ү, WPM, accuracy and personal best.
- Browser-local practice XP, earned coins, fixed-price cosmetics store, original six-car collection expansion (eleven total), equipped trails/titles/stickers and an eight-tier free seasonal reward pass.
- Friend-only guest rooms, 2–6 players, 8-character invite code, Ready, countdown and real-time race progress.
- Server-computed race progress, per-socket abuse limits and same-origin browser API protection.
- Unit tests, TypeScript checks, Vite/Worker build, two Chromium E2E scenarios.
- Shop and season routes are **not yet server-authoritative**; local browser progression can be manipulated and has no real-money value.
- One Cloudflare Worker hosts **both the game website and /api endpoints**, so no separate Cloudflare Pages deployment or CORS environment variables are needed.

**Not included:** account login, official leaderboards, ranked matches, tournament management, paid battle pass or verified purchase ledger, persisting trusted results, reconnect/resume, serious bot prevention, load testing, Cloudflare WAF rules, and production-grade monitoring.

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

## Deploy to Cloudflare: easiest manual route

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
- The Durable Object stores room creation in persistent storage; current player/game state is **memory-only**, so an object restart can disrupt a race. Hibernation/durable snapshots and reconnect logic are essential before ranked play.
- Per-isolate room creation limits are not global enforcement; configure account-level Cloudflare WAF/rate limits and watch usage before opening to strangers.
- Browser localStorage stats are manipulable, unverified and never qualify for money/real prizes.
- D1 migration in `backend/migrations` is only a future scaffold. **No D1 binding/migration and no paid R2 storage are required for this beta.**
- Before real competition: OAuth, D1 user/score model, rate-limited matchmaking, tamper/bot investigation, moderation, GDPR/privacy requirements where applicable, observability, retries, load and cost measurements, staging-to-prod release gates.

The experience is original; external typing games inspire interaction patterns but no third-party copyrighted game code/assets are copied.
