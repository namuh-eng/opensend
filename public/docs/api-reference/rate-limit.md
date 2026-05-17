# Usage Limits

Rate limits, quotas, and operational limits.

OpenSend enforces tiered rate limits in middleware. Email send routes are stricter than read routes. Operators can back rate limiting with Redis or disable it for local development.

## Default route tiers

- Single email send: strict per-minute limit.
- Batch send: stricter per-minute limit.
- API key mutations: tight mutation limit.
- Other writes: general write limit.
- Reads: generous read limit.

## Headers

Responses include `X-RateLimit-Backend` to indicate the active backend. `429` responses may include `Retry-After`.
