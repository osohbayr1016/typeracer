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
- DO `leaderboard_oauth_states` expires after five minutes, is bound to the initiating session and is consumed on success. Provider identity mapping is unique by (provider,provider_id). Re-login uses existing provider profile and rotates its session; separate guest stats are not automatically merged to avoid score duplication.
- `POST /api/auth/logout` revokes/rotates the old guest bearer and replaces the browser session with a clean guest. It does not delete historical provider scores/team; later provider login restores the linked account.
- Guest score/Team access remains available without social login. Anonymous accounts can be farmed; rate limiting, bot protection, high-confidence cheating detection, long-lived token hashing, account recovery, deletion/export, moderation, provider live QA, and profile/coin inventory reconciliation are **outstanding**, not verified as complete.
- Neither OAuth nor player leaderboard should be considered secure ranked competition until those checks are implemented and measured.
