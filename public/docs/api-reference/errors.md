# Errors

Common OpenSend API error shapes and status codes.

OpenSend returns JSON errors. Public API errors may include stable fields such as `name`, `code`, `message`, and `statusCode`.

## Common errors

- `missing_api_key` — no Bearer token was provided.
- `invalid_api_key` — token was not recognized.
- `validation_error` — request body failed validation.
- `rate_limit_exceeded` — retry after the returned window.
- `recipient_suppressed` — recipient cannot be sent to because of suppression policy.
- `idempotency_conflict` — the same idempotency key was reused for a different payload inside the replay window.

Treat error names as programmatic identifiers and error messages as human-facing context.
