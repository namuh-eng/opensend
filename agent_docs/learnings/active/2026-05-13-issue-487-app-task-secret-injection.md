---
date: 2026-05-13
issue: "#487"
type: decision
promoted_to: null
---

## ECS app deploy must register a fresh task definition for new required secrets

The production app deploy path previously only rebuilt/pushed the app image and forced a service redeploy, so a newly required startup secret could be omitted forever if the existing ECS task definition did not already contain it. For required app boot secrets such as `WEBHOOK_SECRET_ENCRYPTION_KEY`, the deploy script should render/register a new app task definition from the current one, preserve existing task/container settings, and upsert the missing `secrets[]` entry before `aws ecs update-service --task-definition ...`.

Keep this path value-safe: resolve the AWS Secrets Manager ARN with `describe-secret`, but never fetch or print the secret value. Let operators override the secret id/ARN when bootstrap naming differs.
