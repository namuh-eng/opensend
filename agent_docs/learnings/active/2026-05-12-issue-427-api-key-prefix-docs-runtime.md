---
date: 2026-05-12
issue: "#427"
type: decision
promoted_to: null
---

## API-key prefix docs can change independently from runtime generation

Issue #427 standardized public examples and synthetic fixtures on `os_...` while explicitly requiring no runtime behavior change. Keep `packages/core/src/services/apiKeys.ts` token generation untouched unless a separate runtime-migration issue changes the persisted/API contract; docs, SDK README examples, in-app snippets, and test fixtures that merely model caller-provided OpenSend keys should use `os_...`.

Legitimate `re_...` references may remain when documenting upstream Resend target-contract behavior in parity docs.
