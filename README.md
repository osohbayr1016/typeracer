# Typeracer Mongolia — playable MVP

A fast, responsive Mongolian Cyrillic typing-race game. This is an **initial unranked beta**, not a production-ready paid competitive platform.

## Stack (based on osohbayr1016/standoff-)

- npm workspaces, TypeScript monorepo
- React 19 and Vite 7 frontend
- Hono 4, Cloudflare Workers backend
- Cloudflare Durable Objects and WebSocket real-time guest multiplayer
- D1 migration scaffold for future **authenticated and verified** leaderboard
- Cloudflare R2 reserved for future moderated cosmetic assets (not used or deployed in this version)

This implementation starts from an almost-empty repository and **does not copy** standoff-'s application logic, private files, credentials, or databases.

## What works in the first version

- Mongolian Cyrillic (Ө, Ү) and English typing practice
- Keystroke feedback, speed (WPM), accuracy, elapsed time and personal best
- Device-local XP, three free vehicle appearances
- Unranked guest multiplayer rooms: 2–6 players, share code, Ready, synchronized countdown, one authoritative Durable Object per room
- Server accepts one character at a time and calculates race progress itself; rejects malformed keystrokes and caps per-socket bursts
- CI for typechecking, unit tests, frontend build and Worker bundling

No national leaderboard, authentication, public ranked matches, paid passes, money, or server-persisted wins are enabled. Local XP and records are **for practice only**. Bots and scripts still require additional anti-cheat systems before competitive rankings can be trusted.

## Local development

Requirements: Node.js 22+ and npm 11.6.2 (npm 10 triggered an Arborist dependency-graph error in CI).

1. npm install -g npm@11.6.2
2. npm install
3. Terminal 1: npm run dev:api
4. Terminal 2: npm run dev:web
5. Open http://localhost:5173
6. For multiplayer, create a room in one browser window, enter the code in a second window, then press Ready in both. Race starts after three seconds.

Vite proxies requests and WebSockets from /api to http://localhost:8787. Solo typing runs even without a backend.

Run verification:

~~~sh
npm run typecheck
npm test
npm run build
npm run build:worker -w backend
~~~

## Production hosting: extra steps are necessary

- Deploy the Worker from backend using Wrangler, after configuring your Cloudflare account.
- Change backend/wrangler.jsonc FRONTEND_ORIGIN from localhost to the **exact** Cloudflare Pages origin (scheme included, no trailing slash); never commit secrets.
- Build frontend/dist and deploy as a Cloudflare Pages static site.
- Set frontend's VITE_API_URL during build to the HTTPS Worker origin (no /api suffix). The Vite dev proxy is not used in production.
- Configure Cloudflare WAF rate limiting at the edge, monitoring and alerts, and independent host/browser smoke tests before making multiplayer public.
- D1 is **not bound** in this first version. The migration under backend/migrations is reserved for authenticated and verified data and must not be applied as a public unverified leaderboard.
- For future monetization, store provider keys exclusively in Wrangler secrets and verify payment callbacks server-side with idempotency.

## Security and limitations

- Guest room codes are not passwords. Anybody with a valid code can join; do not use rooms for private content.
- Game state lives in Durable Object **instance memory**, and reinitialization can terminate an unfinished room. Implement hibernation, durable snapshotting and disconnect recovery before ranked matches.
- Per-isolate HTTP limiting and per-connection keystroke limits are only partial abuse reduction; **not** global rate limiting or complete anti-cheat.
- Practice data uses browser localStorage, is changeable by the user, and never enters a national or prize leaderboard.
- The server independently processes letters; it does not rely on a client WPM claim. An automated bot can still type.
- No secrets, tokens, or payment accounts are part of the repository.

## Roadmap

1. Current: standalone playable solo typing loop, original Mongolian phrases, guest multiplayer, CI.
2. Next: test in real browsers and Cloudflare, keyboard-layout guidance, accessibility and input-method testing, reconnect/resume, durable timers.
3. Then: strong OAuth login, D1 identity/profiles, globally rate-limited matchmaking, ranked results with abuse review, ELO/MMR and nation-wide leaderboard.
4. Later: tournament operations, moderation, audited car cosmetics in private R2, signed economy ledger and server-authoritative free/premium battle passes.
5. Scale: measured load/stress tests, query benchmarks, edge observability, cost caps, phased deployments and rollback.

The game uses its own phrases and basic visual assets. Nitro Type, Monkeytype and TypeRacer are **inspiration for genre and UX**, not sources of copied game code, brand assets or licensed content.
