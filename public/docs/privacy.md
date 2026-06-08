# Privacy

Self-hosted OpenSend is built around an explicit zero-phone-home default.

## The promise

A self-hosted OpenSend deployment makes zero outbound calls to OpenSend-operated vendors unless you configure them. No version pings. No anonymous usage stats. No error reports. No analytics events. No license checks.

If you run `docker compose up -d` from `.env.example`, the only outbound calls OpenSend makes are the ones you explicitly configure, such as AWS SES, AWS S3, your Postgres host, Cloudflare DNS, Redis, SQS, or webhook destinations.

## What self-hosters control

Self-hosters choose:

- Where the app, ingester, scheduler, database, queue, and cache run.
- Which AWS account and SES region sends mail.
- Whether Sentry, PostHog, OpenTelemetry, CloudWatch, or any other observability backend is enabled.
- Which webhook endpoints receive delivery events.
- Which secrets manager stores production credentials.

Leaving telemetry environment variables unset means OpenSend does not emit telemetry to OpenSend, Namuh, Sentry, PostHog, or a license server.

## Hosted OpenSend boundary

The hosted OpenSend/Namuh deployment can configure Sentry, PostHog, CloudWatch, and related observability variables for the hosted service. Those settings are operator configuration, not self-host defaults.

None of those services are required to run OpenSend yourself. A self-hosted deployment can omit them entirely or point equivalent telemetry variables at the operator's own backend.

## Optional observability

When configured by the operator:

- Sentry can receive application errors and performance traces.
- PostHog can receive product analytics events.
- OpenTelemetry can export traces, metrics, and logs to the operator's collector.
- CloudWatch can receive structured logs or embedded metrics in AWS deployments.

These integrations should be treated like production data processors. Configure scrubbing, retention, access control, and sampling according to your own security posture.

## Reporting concerns

If you find an unconditional outbound call, hidden default DSN, version ping, analytics event, or license check in a self-hosted path, report it as a bug. Email `security@namuh.co` for private security reports, or open an issue when no sensitive details are involved.
