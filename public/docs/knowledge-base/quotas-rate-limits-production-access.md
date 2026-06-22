# Quotas, rate limits, and production access

OpenSend has application-level rate limits, plan quotas, and provider-side sending limits. Treat them as separate controls.

## Middleware rate limits

When rate limiting is enabled with Redis, OpenSend applies stricter limits to high-risk routes:

- Single email sends: 20 POST requests per minute.
- Batch email sends: 5 POST requests per minute.
- API key mutations: 10 write requests per minute.
- Domain creation: 10 POST requests per minute.
- Other write operations: 30 requests per minute.
- GET requests: 100 requests per minute.

If `RATE_LIMIT_BACKEND` is disabled, these middleware limits are not enforced. If it is set to `redis`, `REDIS_URL` must be configured.

## Plan quotas

Hosted plan quotas are counted across API and broadcast sends. Current public plan examples include Free at 500 emails/month, Lite at 15,000 emails/month, Starter tiers at 51,000 or 100,000 emails/month, Growth tiers up to 500,000 emails/month, and Scale/custom for BYO AWS or custom needs. Free is hard-capped with no overage. Paid plans soft-cap included emails: sends continue beyond the included quota and overage is billed at $0.85 per 1,000 emails. OpenSend records 80% and 100% usage-threshold timestamps for notification hooks; hosted email delivery for those notifications can be attached to those recorded transitions. Use the billing dashboard as the source of truth for the active workspace.

## Provider limits

Self-hosted deployments also depend on AWS SES account status, region, production access, daily quota, and per-second send rate. If OpenSend accepts mail but SES rejects delivery, inspect provider errors and account quota.
