# Privacy and telemetry

OpenSend is source-available under the Elastic License 2.0. We do not believe a
self-hostable email platform should phone home.

## The promise

**A self-hosted OpenSend deployment makes zero outbound calls to any vendor we
operate.** No version pings. No anonymous usage stats. No error reports. No
analytics events. No license-key checks.

If you run `docker compose up` without setting any of the variables below, the
only outbound calls OpenSend makes are the ones you explicitly configure
(AWS SES, AWS S3, your Postgres host, Cloudflare for DNS, your configured
webhook destinations).

## What hosted deployments collect

The official hosted deployment at `namuh.co` enables the following telemetry by
setting the env variables documented in `.env.example`. None of these are
required to run OpenSend; they are opt-in for operators.

### Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`)

When set, application errors and a small fraction of performance traces are
sent to Sentry. Before any event is sent, the following scrubbing runs in
`src/lib/observability/sentry-scrub.ts`:

- Email addresses are replaced with `[redacted-email]` in messages, exception
  values, and user identifiers.
- IP addresses are dropped from user context.
- Sensitive headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`,
  `X-Auth-Token`, `X-Csrf-Token`, `X-Forwarded-For`) are replaced with
  `[redacted]`.
- Query string parameters matching known secret names (`token`, `access_token`,
  `refresh_token`, `code`, `state`, `secret`, `api_key`, `password`, `email`,
  ...) are replaced with `[redacted]`.
- Cookies are emptied.

`sendDefaultPii` is `false`. Session replay (if enabled) masks all text and all
input fields by default.

### PostHog (`NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_API_KEY`)

When set, product-analytics events (page views, clicks, submits) are sent to
PostHog. Configuration:

- `person_profiles: "identified_only"` — anonymous visitors are not assigned a
  profile.
- `mask_personal_data_properties: true` — properties matching known PII patterns
  are masked.
- `respect_dnt: true` — browsers sending Do Not Track are not tracked.
- Session recordings (if enabled) mask all inputs and all `[data-private]`
  elements.

### OpenTelemetry (future)

When configured via `OTEL_EXPORTER_OTLP_ENDPOINT`, OpenSend will emit traces,
metrics, and logs to **your** OTel-compatible backend (Grafana, Honeycomb,
Tempo, Jaeger, your collector). OpenSend does not host an OTel collector and
will never receive your OTel data.

## Disabling telemetry on a hosted deployment

Operators can disable any of the above by removing the corresponding env var
from the deployment and redeploying. There is no kill switch beyond
"don't set the env var" — that is intentional.

## Reporting concerns

If you find code in this repository that violates the zero-phone-home promise
above (an unconditional outbound call, a default DSN, an obfuscated ping, etc.),
please file an issue or email security@namuh.co. We treat this as a bug.
