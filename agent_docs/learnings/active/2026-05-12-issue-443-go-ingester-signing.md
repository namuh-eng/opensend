---
date: 2026-05-12
issue: "#443"
type: pattern
promoted_to: null
---

## Go ingester signing parity stays fixture-first and shadow-only

For bounded Go ingester parity slices, port pure deterministic helpers first and prove parity with fixtures generated from the current TypeScript source of truth before wiring any runtime path. Webhook delivery signing mirrors `packages/core/src/webhook-signing.ts` exactly, including first `whsec_` occurrence removal and `msgId.timestamp.body` HMAC input, but does not enqueue, dispatch, retry, or replace `packages/ingester`.
