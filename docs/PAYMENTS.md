# Wire / QPay payment test

Open `/coins` or click the coin balance in the header. Regular coin packs and the one-time Supporter bundle are available; the **10 coins for 100 MNT** connection test remains in a collapsed section. See [commerce and racing release](MONETIZATION-AND-RACING.md) for prices and recovery requirements. Package amounts live in `packages/shared/src/payments.ts`; MNT is a whole-tögrög integer, with no ×100 conversion.

## Deployed configuration

- The existing Worker needs `WIRE_API_KEY` with the project's live key. Keep it server-side; use a Cloudflare encrypted secret for new installations. Never commit it or use a `VITE_` variable for it.
- `keep_vars: true` preserves dashboard runtime variables when the GitHub workflow deploys. This matters for this deployment, where the merchant key was already entered in the dashboard.
- No new D1 database, Durable Object binding, or Cloudflare credentials are needed. Orders, receipts, paid inventory, and debits use additive tables in the existing SQLite coordinator.
- The existing GitHub workflow builds the frontend and deploys both frontend/API on main. A successful build alone does not prove live checkout works.

## Fulfilment

The server creates a PaymentIntent, then a hosted checkout session with stable operation-specific idempotency keys. It stores the order before calling Wire. The browser receives only an order ID and the validated `https://pay.wire.mn` checkout URL. Price and coin quantity come from the server's package catalog.

The return page and subsequent wallet refreshes read the PaymentIntent from Wire. Only an exact matching ID, amount, currency, order metadata and `succeeded` status can credit the durable ledger. Refreshing, replaying a callback, or opening two tabs cannot credit an order twice. A foreign browser session cannot read another player's order. Wallet refresh also recovers recent pending orders if the buyer closes checkout before returning. If this service is unavailable after payment, return to `/coins` later and use the same account; do not pay again merely because confirmation is delayed.

Purchased coins have a server-held balance. They are separate from the existing device-local race-earned coins. In the shop, items affordable with purchased coins have an explicit purchased-coin button. Debits and ownership are stored server-side at the shared catalog price. The existing practice XP, level gates and earned cosmetic inventory remain a browser-local beta, and are not suitable for prizes or transferable monetary assets. Do not describe this as a fully server-authoritative game economy.

Ordinary buyers must link Google/Facebook or save their one-time recovery code before checkout. Recovery restores paid purchases on another device. The small connection test can still use a guest session. There is no transfer or cash-out feature.

## Optional webhook

Polling works without a webhook. `POST /api/webhooks/wire` also supports a signed webhook and re-reads the PaymentIntent before fulfilment. It accepts Wire's signed endpoint-verification ping and supports multiple signature values with a five-minute timestamp tolerance.

To enable this optional path, register the deployed `/api/webhooks/wire` URL in Wire, store the returned **`whsec_...` signing secret** as `WIRE_WEBHOOK_SECRET`, and verify the endpoint in Wire. A webhook URL is not a signing secret. An unset or URL-valued signing secret causes webhook requests to fail closed; polling continues to work. Do not create a second endpoint if one already exists.

## Acceptance test

1. Click the header coin balance → `100 ₮ · ТӨЛӨХ`.
2. Confirm the hosted page says **100 MNT**, choose QPay and display the QR/bank-app links.
3. The account owner completes the small payment themselves.
4. Return to the site and confirm **10 purchased coins**. Refresh and confirm the balance stays 10.
5. A canceled or unpaid checkout must show zero new coins. Simulated/forged `success` return URLs must not grant coins.

Automated SQLite/API and native Worker tests cover recovery, supporter grants, account merges, sequenced input, package tampering, retry after timeout, idempotent fulfilment, mismatched payment amounts/currency, cancel, foreign accounts, debit replay/overspending, signed webhook verification and wallet recovery. Browser tests cover the coin entry point, clear missing-config UI and an unpaid return path. Unit mocks do not prove that a real bank payment settled.

Reference: https://docs.wire.mn/en/docs/quickstart
