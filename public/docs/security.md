# Security

OpenSend is an email platform, so the security model centers on tenant isolation, API-key protection, signed webhooks, secret encryption, rate limiting, and explicit operator-controlled integrations.

## API keys

API requests use bearer tokens. Store API keys only in server-side environments and rotate them when they leave the boundary you control.

Recommended operator posture:

- Treat API keys like production credentials.
- Store hashes or encrypted values at rest; never commit real keys.
- Scope keys to the organization/tenant that created them.
- Revoke unused keys and rotate leaked keys immediately.

## Tenant isolation

Dashboard and API routes are tenant-scoped through Better Auth organizations and server-side ownership checks. Production changes that touch auth, tenants, API keys, or persistence need real route/database proof, not client-side mocks.

## Webhook signing

Outbound webhooks are HMAC signed with Svix-compatible headers. Consumers should verify signatures before processing events, and operators should rotate endpoint signing secrets if an endpoint is compromised.

`WEBHOOK_SECRET_ENCRYPTION_KEY` encrypts webhook signing secrets at rest. Docker Compose passes it into both the app and ingester. `.env.example` includes a local-only placeholder for evaluation; production deployments must replace it with a generated secret:

```bash
openssl rand -hex 32
```

## Ingester and job endpoints

The ingester exposes SES/SNS event routes and internal job routes. Keep the ingester public only where providers need to reach it.

- `/events/ses` receives SES/SNS events and verifies provider signatures.
- `/jobs/*` endpoints are scheduler/worker control routes and require `Authorization: Bearer ${INGESTER_JOB_TOKEN}`.
- `/events/inbound` rejects production requests unless `INGESTER_INBOUND_TOKEN` is configured and sent by the inbound provider.

Use unique 32+ character secrets for `INGESTER_JOB_TOKEN` and `INGESTER_INBOUND_TOKEN` in shared or production deployments.

## Rate limiting

API rate limiting is enforced in Next.js middleware. Outside Docker Compose, an unset backend is treated as `disabled` for single-process local development. Shared, production, and multi-replica deployments should use Redis:

```env
RATE_LIMIT_BACKEND=redis
REDIS_URL=rediss://default:<password>@your-cache-endpoint:6379
OPENSEND_APP_REPLICAS=2
```

The reference Docker Compose stack starts Redis and defaults the app to `RATE_LIMIT_BACKEND=redis`. For other deployments, `REDIS_URL` alone does not enable rate limiting; set `RATE_LIMIT_BACKEND=redis` explicitly. Keep Redis private to the runtime network and use TLS endpoints for managed production Redis.

## Secret management

Never hardcode provider tokens, OAuth secrets, database passwords, API keys, Stripe secrets, Cloudflare tokens, AWS credentials, or webhook secrets in source, images, scripts, or screenshots.

The local `BETTER_AUTH_SECRET` placeholder in `.env.example` exists only for localhost evaluation. Production startup checks reject that placeholder when the configured app URL is not localhost.

For production:

1. Generate secrets with a cryptographically secure generator such as `openssl rand -hex 32`.
2. Store them in a secrets manager.
3. Inject them into the app, ingester, scheduler, and migrator at runtime.
4. Rotate secrets after incidents, personnel changes, or accidental exposure.

## Telemetry boundary

Self-hosted OpenSend does not send version pings, anonymous analytics, error reports, or license checks to OpenSend-operated vendors unless an operator configures those variables. See [Privacy](/docs/privacy).

## Vulnerability reporting

Please report suspected vulnerabilities privately by emailing `security@namuh.co`. Include the affected version or commit, impact, reproduction steps, and whether any secret or tenant boundary may be involved.

Do not include real customer data, production credentials, or exploitable details in public issues.
