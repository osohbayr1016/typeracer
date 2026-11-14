# Request-body limits — 2026-11-14 hardening

## Confirmed gap

Several coordinator endpoints used `Request.text()` or `Request.json()` before enforcing
size limits. The ranking/team endpoints checked only the user-controlled
`Content-Length` header. A streamed request without that header could bypass
the intended 4 KiB cap and force the Worker to buffer more data than necessary.

## Remediation

- A shared UTF-8 byte-bounded stream reader caps memory during ingestion.
- The account/team, progression, account recovery, OAuth and paid-item/checkout
  POST routes all use the bounded JSON object parser.
- The Wire webhook retains its exact raw signed UTF-8 text, rejects requests
  over 64 KiB, and returns HTTP 400 for invalid signed JSON.
- Limits remain 256/512/2048/4096/65536 bytes as appropriate.
- Regression tests cover chunked bodies without a length, dishonest length,
  multi-byte Mongolian characters, malformed JSON and invalid UTF-8.

This reduces request buffering abuse. It does not replace Cloudflare WAF,
edge connection limits, rate limits, real payment-provider acceptance testing,
or a performance/load test. No production deployment is part of this work.
