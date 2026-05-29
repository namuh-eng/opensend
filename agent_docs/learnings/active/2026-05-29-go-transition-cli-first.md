---
date: 2026-05-29
issue: go-transition-phase-b
type: decision
promoted_to: null
---

# Go Transition: CLI-First Strategy and ingester-go Deletion

## Decision

The Go workspace in this repo is `services/opensend-cli` — a user-facing CLI tool built
with cobra. The experimental `services/ingester-go` skeleton has been deleted.

## Why CLI-First, Not Worker-First

The original impulse (issue #71, issue #280) was to rewrite the Bun/Hono ingester in Go
for performance reasons. After a 10-round Codex debate (captured in `.omc/state/`), the
consensus was: **Go for new artifacts, TypeScript for product**.

Three reasons CLI-first won:

1. **Lower risk.** The CLI has no production traffic path. A bug in `opensend send` does
   not break email delivery; a bug in a reimplemented ingester worker could drop bounces,
   stall scheduled sends, or corrupt email states. The blast radius is completely different.

2. **Faster user-visible win.** A working `opensend doctor / send / api-keys` command
   ships value to self-hosters in days, not weeks. The ingester rewrite requires full
   parity with HMAC signing, SQS polling, webhook fan-out, and the Stripe billing path
   before it is safe to cut over even a single traffic percentage.

3. **Easier AI iteration.** CLI commands are pure request/response with an httptest mock
   server. A correct test takes 30 lines. A correct ingester-worker test needs a full SQS
   mock, a real Postgres row lifecycle, and SNS signature verification. The iteration loop
   is an order of magnitude slower.

## Why ingester-go Was Deleted

- It had been shadow-only for weeks with zero production traffic, no active development,
  and no parity tests against the Bun implementation.
- The signing parity work (issue #443) that _was_ useful from ingester-go was carried
  forward as fixture tests in the TS codebase, not as a Go service.
- Keeping a skeleton around creates false confidence ("we have a Go ingester") and
  confusion in the deployment docs ("do I wire this in or not?").
- The new Go workspace (`services/opensend-cli`) is the correct home for all new Go
  artifacts in the repo.

## The 10-Round Codex Debate

The `fresh debate → Y verdict` referenced in the Phase B PRD resolved two forks:

- **Fork A**: Full Go rewrite of ingester (performance-first). Rejected because Codex's
  failure mode #3 applies: "Performance gains are imaginary because the bottleneck is
  Postgres/SES/SQS, not runtime overhead." The benchmark work in Phase B (US-006/US-007)
  was commissioned to measure this directly.
- **Fork B**: CLI-first Go workspace (risk-first). Accepted. Delivers measurable value
  immediately and creates the benchmarking harness needed to make a data-driven decision
  about future ingester migration.

## Go SDK (packages/sdk/go)

The Go SDK work (`packages/go-sdk/`, issue #356) is a *client* SDK — not an ingester
replacement. It stays. The deletion of ingester-go does not affect it.

## Signing Parity

The HMAC-SHA256 signing parity between Go and TypeScript (originally prototyped in
`services/ingester-go/internal/webhooksigning/`) is preserved as:

1. Benchmark fixtures at `bench/fixtures/webhook-payload.json`
2. Go benchmark in `services/opensend-cli/internal/bench/`
3. The production HMAC implementation stays in `packages/core/src/webhook-signing.ts`

## References

- Phase B PRD: `.omc/state/sessions/e8bd8cbd-fe31-444f-8737-6ecf362f1150/prd.json`
- Learning: `2026-05-09-issue-280-go-ingester-shadow.md` (original shadow decision)
- Learning: `2026-05-12-issue-443-go-ingester-signing.md` (signing parity work)
- Go SDK issue: #356
