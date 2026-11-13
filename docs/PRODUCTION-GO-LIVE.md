# Production go-live guide — TypeRacer Mongolia

The code and current `main` CI can be release candidates, **but green CI/staging alone is not proof that banking, live OAuth, mobile Safari/Android or concurrent production load work**. Do not call the game fully certified until this checklist is completed.

## Separation and release controls

- Staging remains `mongolian-typeracer-staging` with its existing Durable Object SQLite and uploaded frontend.
- Production config is `backend/wrangler.production.jsonc`, deploying a **different** Worker named `mongolian-typeracer-production` with an **independent** named Durable Object SQLite namespace.
- **No staging balances, linked accounts, private room codes or paid order history are migrated** automatically. Never overwrite existing staging data in an attempt to move to production.
- `.github/workflows/production.yml` runs **only** by a manual workflow dispatch from `main` with the exact confirmation `DEPLOY PRODUCTION`. It binds the GitHub `production` environment, repeats typecheck/unit/build/native Worker/Chromium E2E, deploys only if those pass, and runs the smoke script against the returned production URL. Protect the `production` environment in GitHub with required reviewers and protected-branch restrictions BEFORE authorizing a release.
- Keep separate, least-privilege `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in production-environment secrets. Never put account IDs or secrets in source.

## Required manual actions BEFORE advertising real-money checkout

- [ ] Verify a custom domain/HTTPS URL belongs to your production Worker; set `OAUTH_REDIRECT_ORIGIN` to that exact URL as a Worker secret/variable and register identical Google/Facebook callback URLs. Confirm provider buttons are disabled if either client credentials or the HTTPS origin is missing.
- [ ] Configure Google/Facebook client IDs and encrypted client secrets through Cloudflare. Test an actual account link, logout, re-login and recovery on separate devices. Verify cross-device XP, inventory and past paid orders remain attached to the linked account.
- [ ] Add `WIRE_API_KEY` as a production-only encrypted secret. Optionally install the actual Wire webhook signing secret as `WIRE_WEBHOOK_SECRET`. Never use mock API keys to accept money.
- [ ] Run a **real owner-authorized small payment** through QPay/Wire and independently reconcile: provider PaymentIntent status, MNT amount, order metadata, wallet credit, paid cosmetic, repeat callback, failure/cancel, refresh, second device, and bank-provider settlement. Test support/refund/dispute reconciliation policy with the merchant.
- [ ] Configure Cloudflare WAF/bot protection, rate limits, domain verification and least-privilege access. Built-in SQLite limits protect checkout, recovery and room creation; they are not a replacement for WAF or account-abuse review.
- [ ] Test actual iOS Safari, Android Chrome and desktop keyboard layouts, especially Mongolian Ө/Ү, composition, paste prevention, keyboard-open focus, mid-race reconnect and voice/assistive technology accessibility.
- [ ] Perform concurrent matchmaking/DO SQLite write-load tests and set acceptable p95/p99 race input latency, error rate, queue time, memory and reconnect targets. Current test fixtures do **not** certify real 40–60-user production traffic.
- [ ] Configure application telemetry, alerting, data-retention, privacy/support contact, terms for paid currency, chargebacks/refunds, storage/restore drills and a rollback plan. Cloudflare code rollback does not automatically roll back SQLite database migrations.
- [ ] Review limitations before marketing competitive ranks: bots are visible, weekly human PvP and daily XP are **beta**, and there is no proven tournament-grade anti-cheat, MMR, prize compliance, or one-human-one-account enforcement. Do not offer cash prizes based on these scores.

## Validation and release

1. Wait for all relevant PRs to merge and the latest `main` pipeline's live **staging** smoke test to pass.
2. Confirm staging manual scenarios: solo/daily challenge, 2-browser public race, 2-browser private race plus reload, trusted XP coins/claims and season, daily and weekly standings, real social login (when configured), Wire checkout and refunds (in the authorized merchant environment).
3. On GitHub create or protect the `production` Environment. Configure separate production-scoped Cloudflare deployment credentials.
4. In Actions choose **Production release (manual, verified)** → **Run workflow** with branch `main` and confirmation `DEPLOY PRODUCTION`. Approve the protected environment through GitHub's normal reviewer flow.
5. Confirm production deployment URL is printed by Wrangler; inspect API health, private and public WebSocket smoke, online daily ledger and homepage. Keep real-money checkout disabled until merchant QA is complete.
6. Record the deployed commit SHA, observe errors and latency during rollout, and use Cloudflare's deployment rollback procedures if necessary. Preserve Durable Object data; avoid destructive schema downgrades.

**Release status:** Production pipeline and isolation can be implemented and CI-verified here. External merchant QA, live OAuth, real-device load/security review, support/refund operations and operator approval require work outside the repository; no automated test should claim those checks were completed.
