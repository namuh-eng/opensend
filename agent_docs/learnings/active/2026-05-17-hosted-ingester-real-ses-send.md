---
date: 2026-05-17
issue: hosted-email-send
type: mistake
promoted_to: null
---

# Hosted ingester must not use dev SES stubs in ECS

Production ECS tasks rely on IAM role/container credentials, so SES code must
not decide to stub sends only because `AWS_ACCESS_KEY_ID` is absent. Dev stubs
should be limited to local development mode without any AWS credential source.

For Bun-built ingester images, set `NODE_ENV=production` before `bun build` so
compile-time environment reads cannot inline development behavior into the
production bundle. Once the ingester is truly production, it also needs the same
required auth secrets as the app task (`BETTER_AUTH_SECRET`, Google OAuth
secrets, and `BETTER_AUTH_URL`) because importing shared auth/db modules can
perform production startup validation.

Runtime proof should include a fresh SDK send with `sent_at` non-null plus
CloudWatch logs showing `operation=ses.send` `status=ok` and no `[DEV] SES send
skipped` line for the same email ID.
