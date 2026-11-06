# Commerce and reliable racing

## Offers shipped

Prices below are initial product settings in `packages/shared/src/payments.ts`, not estimates of another game's prices.

| Product | Price (MNT) | Contents |
| --- | ---: | --- |
| Эхний гараа | 1,000 | 200 purchased coins |
| Хүлгийн сан | 5,000 | 1,100 coins, including 100 bonus coins |
| Том цуглуулга | 10,000 | 2,400 coins, including 400 bonus coins |
| Дэмжигч | 9,900 | 2,000 coins, gold trail, crown sticker and Supporter title |
| Connection test | 100 | 10 coins; kept inside the collapsed test section |

The supporter bundle is a one-time purchase with permanent cosmetic grants. It has no recurring charge, race-speed boost, scoring boost or random reward. Its open checkout is reused across tabs; once fulfilled, another purchase is refused. Products are returned by the server so cached UI prices cannot select the charged amount. Each order snapshots its original amount, coin quantity, label and grants; later catalog changes do not change an existing quote or receipt.

The paid wallet, purchased inventory and supporter grants come from server-verified Wire receipts. A single durable order update grants both coins and its snapshotted inventory; repeated polling/webhooks cannot grant a bundle twice. Reopening a receipt can resume its existing hosted checkout. Wire polling works without an optional webhook.

## Retain paid purchases

Ordinary purchases require either a linked Google/Facebook identity or a recovery code. The 100 MNT connection test remains available to guests.

A recovery code is a 192-bit random credential, displayed once. Only its SHA-256 hash is stored. It is never sent to analytics, put in a URL, or written to localStorage. The owner must save it privately; anyone holding it can restore the account. Restoring it issues a new HttpOnly first-party session and leaves other signed-in devices active. Requests are limited by IP before recovery lookup. A forgotten code cannot be retrieved from the database.

When a guest signs into an existing verified identity, payment orders, paid inventory and recovery aliases move to that account. Duplicate cosmetic debits are consolidated, returning duplicate virtual-coin cost; money is not refunded. The coordinator applies the paid-wallet merge in a synchronous SQLite transaction. Logging out clears the paid wallet and paid-exclusive preview in the browser.

The gold trail, crown and Supporter title are validated against receipts when joining public and friend races. Editing localStorage or WebSocket URL parameters cannot claim these paid-exclusive cosmetics.

## Input protocol 2

Modern clients request `input=2`. The welcome message negotiates the protocol version so older clients and existing races continue to work.

- Each key carries a match ID and a monotonically increasing sequence number.
- The server accepts only the next contiguous sequence. Duplicates and gaps return the last accepted sequence without changing progress or accuracy.
- Snapshots acknowledge the highest accepted sequence and actual progress, attempts, errors and last-error highlight.
- The client predicts the caret and its own car immediately, then rebuilds prediction from acknowledged counters plus pending keys.
- A bounded 64-key memory queue retransmits at most 32 pending keys every 450 ms. Socket-buffer checks prevent unbounded buffering. The server's existing input limit remains enforced, and limited keys can be resent after its window resets.
- A resumed WebSocket reuses the same sequences. A full page reload recovers the server-confirmed prefix; unacknowledged keys held only in the previous page's memory cannot survive a reload. Durable Object process loss is still outside the existing 15-second in-process reconnect guarantee.

NFC normalization and control/paste rejection use the same scoring primitive on server and client. Prompt characters are cached per race. Mistakes remain in the attempt count after correction, and duplicate delivery does not lower accuracy. The live WPM meter uses a one-second minimum sample; final results remain based on server timing and five correct characters per standardized word.

Race input stops at the server deadline even when its timer callback is late. Unfinished elapsed time is capped at the race duration. Bot finish timestamps are calculated from their actual simulated pace instead of the next 100 ms timer tick. Own-car movement uses immediate prediction with a short transform transition; opponents retain interpolated transforms. Reduced-motion settings disable these transitions.

## Validation and remaining boundaries

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run build:worker -w backend`, `npm run test:runtime` and `npm run test:e2e`. The native-runtime smoke test uses real workerd, SQLite and WebSockets with a fake Wire boundary; it cannot spend money. Browser tests cover store pricing/protection, recovery in a fresh browser session, and retransmission after dropping a real race key.

Race-earned coins, XP and earned cosmetic inventory remain the original device-local beta. This release does not make that entire economy server-authoritative, create a prize-money competition, add a real ad network, configure missing OAuth vendor credentials, or guarantee revenue. Purchased coins and paid-exclusive grants are the protected commerce path. Refund automation, tax/merchant reporting, cross-instance race persistence, load testing, and a full server-owned earned economy remain separate work.
