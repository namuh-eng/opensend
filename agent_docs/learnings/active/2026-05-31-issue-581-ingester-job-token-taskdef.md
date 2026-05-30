---
date: 2026-05-31
issue: 581
type: pattern
promoted_to: null
---

# Required ingester secrets need task-definition registration

Production ingester startup now fails closed when `INGESTER_JOB_TOKEN` is missing
or shorter than 32 characters. ECS service redeploys that only rebuild/push the
image and call `update-service --force-new-deployment` will keep reusing the old
task definition, so new required ingester secrets never appear in the container.

When adding required production ingester env, update `scripts/deploy.sh` to
register a fresh ingester task definition from the current service task,
preserve existing container settings, and upsert a `secrets[]` entry by env name
before `aws ecs update-service --task-definition ...`. Use Secrets Manager/SSM
ARN lookup or an ARN override; never commit or print secret values.
