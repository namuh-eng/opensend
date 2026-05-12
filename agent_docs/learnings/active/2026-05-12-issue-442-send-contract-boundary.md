---
date: 2026-05-12
issue: "#442"
type: decision
promoted_to: null
---

## Send/batch public contract boundary lives in core contracts

For issue #442, the adopted public send route family moved request validation,
recipient normalization, success response schemas, and public error-envelope
helpers into `packages/core/src/contracts/`. Keep `src/lib/api-errors.ts` and
`src/lib/validation/emails.ts` as compatibility re-export shims only; new route,
service, SDK, and docs checks should import the core contract boundary instead
of app-local validation internals.

The TypeScript SDK still builds DTO declarations from `packages/core/src/dto` to
avoid pulling Zod/runtime contract files into the published package output.
Mirror public error-code/detail shape changes there when contract response types
change, and prove compatibility with type assertions in `tests/send-contract.test.ts`.
