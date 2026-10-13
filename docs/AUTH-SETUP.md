## Required HTTPS redirect origin (fail closed)

Set `OAUTH_REDIRECT_ORIGIN` to the exact externally reachable HTTPS origin (scheme and host, optional non-default port; no path, query, fragment, credentials or HTTP). The request's effective origin must match it exactly. No OAuth redirect may be constructed from the request Host as a fallback; mismatched, missing or malformed settings disable `/api/auth/providers` and prevent `/api/auth/:provider/start` and `callback` from contacting provider identity services. Both provider credentials **and** a matching redirect origin are required for enabled login buttons. `backend/src/oauth-origin.test.ts` exercises the actual Hono provider/start/callback routes with success and denied-origin cases, plus strict URL parsing. Do not deploy social login if an origin or provider credentials are missing.

# Google / Facebook OAuth — staging setup

Google/Facebook login uses **real OAuth authorization-code flow**, not local fake accounts. The backend performs code-to-access-token exchange over HTTPS, fetches the authenticated provider's user ID, validates a 5-minute CSRF state bound to the original HttpOnly guest session in Durable Object SQLite, links identity to a server player ID, rotates the HttpOnly session, and redirects to /profile. Login remains DISABLED when credentials are not configured. No provider secrets belong in Git, public frontend bundles, URLs, localStorage or GitHub PRs.

## Provider app setup

1. **Google Cloud Console**: Create/configure OAuth consent screen and a Web Application OAuth client. Add the exact staging redirect URL `https://mongolian-typeracer-staging.osohoo691016.workers.dev/api/auth/google/callback` under Authorized redirect URIs. Grant only `openid profile`.
2. **Meta for Developers**: Create a Facebook Login app, configure its Valid OAuth Redirect URIs with `https://mongolian-typeracer-staging.osohoo691016.workers.dev/api/auth/facebook/callback`. Enable the intended app audience and required public_profile permission; development-mode restrictions apply to non-test users.
3. In the **staging Cloudflare Worker**, configure these as server-side secrets/vars (no fake values):
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`
   - `OAUTH_REDIRECT_ORIGIN=https://mongolian-typeracer-staging.osohoo691016.workers.dev`
   You can use `wrangler secret put <KEY>` in the `backend` folder targeting the existing **staging** Worker account. Never paste values into PRs/chats/repository/config files. The staging workflow continues to deploy only from verified main; do not use this to configure production.
4. `GET /api/auth/providers` must return `{"google":true,"facebook":true}` only when credentials for both providers really exist. Visit /profile and test login with actual Google/Facebook accounts. Confirm callback identity, HttpOnly/SameSite/Secure session flags, returning account/team/points, cancel state, expired state, logout and login on a second browser. CI cannot verify real provider apps without those external credentials; **live OAuth QA is required before declaring production ready**.

## Architecture and security

- Only `GET /api/auth/:provider/start` and `GET /api/auth/:provider/callback` are browser-accessible. The Worker exchanges codes and calls the internal DO OAuth state service. Clients cannot directly claim Google/Facebook user IDs.
- DO `leaderboard_oauth_states` expires after five minutes, is bound to the initiating session and is consumed on success. Provider identity mapping is unique by (provider,provider_id). Re-login uses existing provider profile; separate guest stats are not automatically merged to avoid score duplication.
- Session cookies are independent **per device**, expire after 30 days, and only SHA-256 bearer digests are saved in the additive `leaderboard_sessions` table. A second device signing in with the same Google/Facebook provider keeps the first device signed in. Existing pre-migration cookies are migrated on first use without resetting race/team data.
- `POST /api/auth/logout` revokes **only the current browser session** and replaces it with a clean guest. Other devices signed into the same provider stay logged in. It does not delete historical provider scores/team; later provider login restores the linked account.
- Guest score/Team access remains available without social login. Anonymous accounts can be farmed; rate limiting, bot protection, high-confidence cheating detection, long-lived token hashing, account recovery, deletion/export, moderation, provider live QA, and profile/coin inventory reconciliation are **outstanding**, not verified as complete.
- Neither OAuth nor player leaderboard should be considered secure ranked competition until those checks are implemented and measured.
