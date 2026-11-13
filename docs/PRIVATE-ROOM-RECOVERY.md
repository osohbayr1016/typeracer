# Wave 12 — Private-room continuity

## Implemented
- Each private invite-only Durable Object writes its active match, prompt, clock, room stage, racer IDs, accepted Cyrillic keystroke counters, and short-lived resume bearer into an isolated SQLite checkpoint.
- The room code remains valid for its existing one-hour lifetime. A disconnected player keeps the same slot for a maximum 15 seconds; unknown/guessed bearers cannot hijack a racing slot. Old sockets are evicted when a valid resume bearer replaces them.
- Fresh Worker isolates rebuild the private race from durable state, restore countdown/race deadlines, and replay a finished result if the racer reconnects.
- A public room state lists disconnected players with `connected:false`, never their resume bearer. Only the individual WebSocket welcome message contains the resume bearer.
- Frontend `sessionStorage` stores one resume bearer per room and the last active room code. After a browser reload on `/multiplayer/race`, the same racer can reconnect; dropped sockets use bounded exponential backoff with five attempts.
- React StrictMode mount cleanup cancels the zero-delay recovery task to prevent duplicate seats.
- Tests use a real SQLite DatabaseSync with crash/restart simulation, an invalid resume bearer, Unicode typing progress, grace expiration, and result replay; Playwright covers a two-person browser reload.

## Known boundaries
- Public Quick Race retains its separate checkpoint and account-bound rewards. Friend rooms remain unranked and do not mint online currency.
- A reconnected browser resumes the server's accepted caret, not any unsent local keystrokes.
- Private rooms are not resumable after their 1-hour invite expiry; a new room is required.
- A player disconnected longer than 15 seconds loses their reserved slot.
- This is not a distributed multi-region queue. Regional load tests and mobile real-device QA remain required.
