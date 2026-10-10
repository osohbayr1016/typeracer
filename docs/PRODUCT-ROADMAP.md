# TypeRacer Mongolia — product design and delivery plan

## Product direction (approved starting point)

**A playable racing game, not a KPI dashboard.** Nitro Type is a functional inspiration only. Do not copy its logos, layout artwork, proprietary car images, copyrighted texts, or UI assets. In particular, avoid the common AI-generated-design problems: arbitrary neon glows, transparent glass dashboards, fake graphs/map/chat, five unrelated visual effects and unreadable microtype.

### Design system v2
- Base palette: ink #162640, warm white #ffffff, blue #386fe4, sunny yellow #ffc74e, positive green #1caa79.
- Typography: Manrope with system fallbacks; the Cyrillic font must be readable at 320px.
- One primary action per screen. Clear room sharing, Ready, countdown, typing, result/retry.
- The active race and typing passage occupy the largest visual region. Stats and cosmetic selection remain secondary.
- Cars: owned artwork with clear silhouettes, easy skin switching, predictable image dimensions, no layout shift; initial car illustrations are small, local SVGs. Future approved artwork can be served via R2.
- Default visuals avoid animation except brief car/progress transitions. Follow `prefers-reduced-motion`.
- Maintain keyboard focus indicators and distinguish correct/current/incorrect text with more than color.

## Phase 1 — clean responsive racing UI

**Included in this phase:** visual redesign, original car artwork, local skin selection, improved Mongolian clarity, invite-link sharing, responsive behavior. Preserve guest racing, current HTTP and WebSocket API, and existing e2e selectors.

**Acceptance gates:** TS, unit tests, frontend/Worker build, two-browser Playwright tests; manual desktop/mobile/IME and hosted smoke test after deploy. Do not claim Cloudflare deployed until the live URL responds.

## Phase 2 — account / identity and persistent profile

Create a Cloudflare D1 binding (staging first), apply reviewed versioned migrations, and implement actual authentication (prefer reputable OIDC with PKCE or passkeys, not homegrown username/password). Add HttpOnly Secure SameSite cookies, session rotation/revocation, CSRF protection, user profile, unique handles, profile UI, privacy and moderation policies. Require authenticated identity for competitive results and friend lists. Anonymous local practice continues without signing in.

**Acceptance:** browser login/logout and session expiration, authorization test matrix, migration rollback strategy, sign-in rate limits, identity/account deletion flows. Never merge OAuth secrets into git.

## Phase 3 — live racing reliability

Refactor Durable Object race rooms around WebSocket hibernation and stored attachments/durable state and alarms. Support reconnect/resume, disconnect grace, ready reset, fixed server timestamps, stable race IDs, per-race results/events, idempotent D1 writes, room lifecycle and expiration. Don't rely on browser-reported WPM. Validate exact per-character keystrokes, timestamps and feasible rates, without promising impossible bot-proof security. Add public quick play with a queue or matchmaking DO separate from invited rooms.

**Acceptance:** reconnect tests, 2–6 player tests with deliberate dropouts, parallel-room tests, durable restart, real hosted smoke test, latency metrics and load test with defined thresholds.

## Phase 4 — ranking, statistics and fair competition

Persist **only completed server-observed races** tied to accounts, with clear validation and audit state. Split casual scores from **official ranked** results. Calculate WPM and accuracy consistently. Implement leaderboard per period/season and filter, snapshots and paginated queries with indexes in D1. Define MMR/Elo-based skill pairing, abandonment handling, early cancellation, minimum sample sizes, and appeals/moderation. Guard fake scores and rank inflation.

**Acceptance:** unauthorized results cannot be inserted, no client-specified score accepted, ranking updates consistent under retries, reproducible leaderboard queries and query benchmarks.

## Phase 5 — garage, assets, competitions and monetization

- R2: approved, optimized car PNG/WebP with thumbnails, immutable asset URLs and safe uploads; local SVGs remain reliable fallbacks. Add licensing/original art review.
- Garage: owned cosmetics, unlocks and accessibility-safe style options; transaction and inventory ledger in D1.
- Free/premium battle pass only after accounts, fraud controls, clear terms and actual provider integration. Use verified payment webhooks, idempotency and server-only secrets. Never reward purchases based on client claims.
- Tournaments: joining, brackets, scheduling, byes, disconnect disputes, admin audit trails and trustworthy results.

**Acceptance:** server-validated entitlements, repeat webhook tests, permission boundaries, refunds and accounting, event-level rollback and moderation.

## Operational gates for every phase

1. Write/adjust unit/integration/Playwright tests **before deployment**.
2. Build and dry-run Worker.
3. Deploy same-origin Worker+assets to Cloudflare staging on main only after green tests (secrets in GitHub Actions; no secrets in chat).
4. Smoke-test live site and two actual WebSocket players.
5. Measure p50/p95 API and DO latency, error rates, concurrency/cost before expanding.
6. Do not advertise incomplete phases as live. Use feature flags or clearly marked coming-soon states.
