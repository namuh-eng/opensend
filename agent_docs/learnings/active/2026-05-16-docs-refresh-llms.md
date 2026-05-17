---
date: 2026-05-16
issue: docs-refresh
type: pattern
promoted_to: null
---

# Docs refresh should expose both human and LLM entrypoints

When refreshing public docs, keep `/docs` and `/docs/llms.txt` unauthenticated in middleware. Public files alone are not enough if middleware guards non-dashboard paths.

For Resend-compatible docs, lead with root aliases (`/emails`, `/emails/batch`, `/contacts`, `/segments`, `/broadcasts`, `/templates`, `/api-keys`) when they exist, and explicitly label remaining OpenSend-specific `/api/*` routes to avoid over-claiming parity.

## Public docs corpus rule

Public OpenSend docs should be a first-party markdown corpus under `public/docs/**/*.md`, indexed by canonical `/docs/llms.txt`. Resend or competitor docs may inform internal parity work, but public docs must not link users out to competitor docs. Root `/llms.txt` should redirect to `/docs/llms.txt` rather than becoming a second source of truth.
