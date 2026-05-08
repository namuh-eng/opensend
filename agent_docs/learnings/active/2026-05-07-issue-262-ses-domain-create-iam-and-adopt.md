---
date: 2026-05-07
issue: 262
type: decision
promoted_to: null
---

# Dashboard "Add domain" failures: IAM root cause + SES adopt-existing behavior

## Symptom

After PR #238 restored dashboard auth on `POST /api/domains`, the dashboard
"Add domain" still 500'd in production. Two distinct errors surfaced in
sequence:

1. `AccessDeniedException ... is not authorized to perform: ses:CreateEmailIdentity`
2. `AlreadyExistsException: Email identity foreverbrowsing.com already exist.`

## Root causes

### (1) ECS task had no SES permissions

The `opensend-app:5` task definition reused `ecsTaskExecutionRole` for both
`executionRoleArn` and `taskRoleArn`. That role only had:

- `AmazonECSTaskExecutionRolePolicy`, `AmazonSSMReadOnlyAccess`, `SecretsManagerReadWrite`
- inline `cloudwatch`, `KMS_DECRYPTION`

No `ses:*`. Every `CreateEmailIdentity` call was denied at the IAM layer.

### (2) Identity already existed in the AWS account

`foreverbrowsing.com` was already registered as an SES identity in account
`699486076867` (verified, DKIM `SUCCESS`) from a prior run. The opensend DB
had no matching row, so the dashboard treated it as never added — but SES
correctly refused to create a duplicate identity.

## Fixes applied

### Dedicated task role

Created IAM role `opensend-app-task` (trust: `ecs-tasks.amazonaws.com`) with
inline policy `opensend-app-runtime`:

- `ses:CreateEmailIdentity`, `ses:GetEmailIdentity`, `ses:DeleteEmailIdentity`
  on `arn:aws:ses:us-east-1:699486076867:identity/*`
- `ses:SendEmail` on identity + configuration-set ARNs
- `s3:GetObject`/`PutObject`/`DeleteObject` on
  `arn:aws:s3:::rc-storage-e469a71830a5/*`

Registered task definition `opensend-app:6` with `taskRoleArn` pointed at
the new role. `executionRoleArn` left unchanged. Service rolled cleanly.

This split (execution role for boot-time agent actions, task role for
SDK calls) is the AWS-recommended pattern and limits blast radius — the
running container now has SES + S3 only, never `SecretsManagerReadWrite`.

### Idempotent `createDomainIdentity` (PR #259)

`src/lib/ses.ts` now catches `AlreadyExistsException` and falls back to
`GetEmailIdentity`, returning the existing DKIM tokens. The new dashboard
row is created from those tokens, so DNS that's already in place keeps
working — no re-verify needed.

## Important caveat (recorded against #262)

The adopt-existing branch is only safe under opensend's current deploy
posture: **one AWS account = one opensend tenant** (the self-hostable
docker-compose default). Under that assumption, "identity already exists
in this AWS account" implies "this tenant owns it."

If opensend is ever run multi-tenant on a shared AWS account, the adopt
branch would hand the dashboard caller live DKIM tokens for a domain
they may not control. Issue #262 tracks the proper long-term fix:
**migrate to BYO-DKIM (Easy DKIM with `SigningAttributesOrigin:
EXTERNAL`)** — generate a per-tenant RSA keypair, publish the public
key as a TXT at a per-tenant selector, sign outbound mail with the
private key. This is the same model Resend uses, and it removes the
`AlreadyExistsException` collision entirely while restoring explicit
per-tenant ownership proof.

## Patterns

- **Always set `taskRoleArn` distinct from `executionRoleArn`.** The
  default of "reuse execution role" silently bloats the running
  container's permissions and breaks least-privilege.
- **Treat `AlreadyExistsException` from SES as a recoverable state for
  account-scoped identities, not a hard error** — but only when the
  surrounding tenancy model guarantees ownership.
