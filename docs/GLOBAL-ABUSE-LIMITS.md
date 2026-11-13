# Global abuse protection — Wave 14

## What changed
The Worker isolate-local checkout/recovery request counters were unreliable across Cloudflare regions and cold starts. Checkout now allows 10 requests per 60 seconds per Cloudflare connecting IP, and account recovery allows 8 requests in the same window. Both are checked at the named, shared global Durable Object before sensitive processing.

A single SQLite table stores only SHA-256(salt + endpoint scope + connecting IP), the fixed-window start, and an attempt count. The cryptographically random salt persists in private Durable Object SQLite. Raw client IP addresses are never stored in the limiter tables. The counter is updated synchronously under the Durable Object's transactionSync, preventing race-condition bypass from simultaneous requests.

Blocked requests receive HTTP 429 and Retry-After indicating remaining seconds. Different scopes and IPs remain independent; the window expires after 60 seconds. Worker edge API routes no longer maintain separate local Maps.

## Security boundaries
- Only CF-Connecting-IP from Cloudflare is considered. X-Forwarded-For is deliberately ignored.
- Requests without CF-Connecting-IP (e.g. local tests) are not counted, rather than lumping all traffic into an "anonymous" IP.
- This is basic global rate limiting, **not** full bot detection, WAF, device attestation, or ranked anti-cheat. Cloudflare WAF rules should also be configured outside code.
- The public matchmaking queue, economy, paid ledger, and legitimate payment callbacks are unchanged.
