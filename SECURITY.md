# Security Policy

OpenSend is source-available infrastructure for sending and operating email, so security reports are handled privately first.

## Supported versions

OpenSend does not have a stable release train yet. Until the first tagged release is published, security fixes target the default branch and are called out in release notes or pull requests when appropriate.

After a release train exists, this file should be updated with the supported version matrix.

## Reporting a vulnerability

Email `security@namuh.co` with:

- Affected commit, branch, release, or deployment path.
- Reproduction steps.
- Impact and affected tenant, credential, webhook, or email-delivery boundary.
- Whether the issue is public, exploited, or tied to exposed secrets.

Please do not open public issues with exploitable details, customer data, API keys, OAuth secrets, AWS credentials, webhook secrets, database URLs, or screenshots containing private information.

We will acknowledge valid private reports as quickly as possible and coordinate disclosure once a fix path exists.

## Self-hosted operators

Self-hosted deployments should rotate any potentially exposed secrets after a security incident:

- OpenSend API keys.
- `WEBHOOK_SECRET_ENCRYPTION_KEY`.
- `INGESTER_JOB_TOKEN` and `INGESTER_INBOUND_TOKEN`.
- Google OAuth secrets.
- AWS, Cloudflare, S3, Redis, SQS, Stripe, Sentry, and PostHog credentials.
- Database credentials.

See [public security docs](public/docs/security.md) for deployment hardening guidance.

## GitHub security policy indicator

GitHub should show the repository security policy after this file is merged to the default branch and GitHub indexes it. Verify with:

```bash
gh repo view namuh-eng/opensend --json isSecurityPolicyEnabled,securityPolicyUrl
```
