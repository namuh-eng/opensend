---
date: 2026-05-10
issue: 297
type: decision
promoted_to: null
---

## Put committed preflight code outside ignored `scripts/`

**What:** Issue #297's hosted Stripe cutover preflight lives at `src/lib/billing/cutover-preflight.ts`, with `package.json` exposing `bun run billing:preflight`.

**Why:** Repository `scripts/*` is ignored by default because infra scripts can contain environment-specific values. New PR-owned automation under `scripts/` can silently be left out unless force-added, so tracked preflight utilities should live in a normal tracked path or be explicitly allowlisted/force-added.

**Pattern:** When adding deploy/check scripts, run `git check-ignore -v <path>` before finalizing and verify `git status --short` includes every intended file.
