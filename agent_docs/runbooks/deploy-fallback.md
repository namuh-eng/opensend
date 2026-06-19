# Deploy fallback runbook for Mac mini runner outage

Issue: #645

OpenSend production deploys normally run through `.github/workflows/deploy.yml` on the `[self-hosted, opensend-deploy]` Mac mini runner. If that runner is offline or unreachable, use this break-glass path from a trusted non-Mac-mini workstation that is already authorized for production AWS deploys.

This runbook keeps the Mac mini as the normal deploy runner. It does **not** migrate the workflow to GitHub-hosted OIDC, does **not** replace the deployment topology, and does **not** fully close the runner SPOF until one real no-op fallback deploy exercise is completed and recorded.

## Prerequisites

Use a trusted operator machine with:

- A clean checkout of `namuh-eng/opensend` at the intended production SHA.
- Docker with `buildx` available and able to build `linux/amd64` images.
- AWS CLI authenticated to the production AWS account with permissions for STS, ECR, ECS, CloudWatch Logs, and Secrets Manager metadata lookups.
- Docker authenticated to the production ECR registry; the preflight performs this with `aws ecr get-login-password | docker login --password-stdin` and does not print the password.
- Network access to AWS ECR/ECS/Secrets Manager in the deploy region.
- No copied GitHub Actions secrets and no dumped runner environment. Authenticate through an operator AWS profile, SSO session, or equivalent approved AWS credential source.

Required tools:

```bash
docker --version
docker buildx version
python3 --version
aws --version
```

## Non-secret environment contract

`scripts/deploy.sh` is the portable deployment primitive used by `.github/workflows/deploy.yml`. The fallback path uses the same script and accepts these non-secret environment names:

| Name | Default | Purpose |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | AWS deploy region. |
| `AWS_ACCOUNT_ID` | resolved from `aws sts get-caller-identity` | Optional account guard. Set it to fail fast if authenticated to the wrong account. |
| `PRODUCT` | `opensend` | Prefix for repositories and services. |
| `ECS_CLUSTER` | `namuh` | ECS cluster name. |
| `IMAGE_TAG` | `latest` | Image tag pushed to ECR. |
| `PLATFORM` | `linux/amd64` | Docker build target platform. |
| `WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID` | `opensend/webhook/secret-encryption-key` | Required Secrets Manager identifier for webhook secret encryption key metadata. |
| `WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN` | unset | Optional ARN override for the same secret metadata when the ARN is already known. |
| `TRACKING_SECRET_SECRET_ID` | `opensend/tracking-secret` | Required Secrets Manager identifier for tracking secret metadata. |
| `TRACKING_SECRET_SECRET_ARN` | unset | Optional ARN override for the same secret metadata when the ARN is already known. |
| `INGESTER_JOB_TOKEN_SECRET_ID` | `opensend/ingester-job-token` | Required Secrets Manager identifier for ingester job token metadata. |
| `INGESTER_JOB_TOKEN_SECRET_ARN` | unset | Optional ARN override for the same secret metadata when the ARN is already known. |
| `INGESTER_INBOUND_TOKEN_SECRET_ID` | `opensend/ingester-inbound-token` | Required Secrets Manager identifier for ingester inbound token metadata. |
| `INGESTER_INBOUND_TOKEN_SECRET_ARN` | unset | Optional ARN override for the same secret metadata when the ARN is already known. |

Do not run `env`, `printenv`, `aws secretsmanager get-secret-value`, or any command that prints credential material into logs, issues, PRs, terminals being recorded, or chat. The fallback deploy only needs secret name/ARN metadata through `aws secretsmanager describe-secret`; it must not fetch secret values.

ECR repository and ECS service names are derived by `scripts/deploy.sh` from `PRODUCT` as `${PRODUCT}-app` and `${PRODUCT}-ingester`. Do not set separate app/ingester repository or service override names for the fallback path unless `scripts/deploy.sh` is changed to honor them first.

## Preflight

Run the preflight before any fallback deploy attempt:

```bash
bun run deploy:fallback:preflight
```

The preflight does not push images, update ECS, run tasks, register task definitions, or fetch secret values. It does write/refresh the local Docker ECR login entry for the resolved registry so `docker buildx build --push` can authenticate before any image build starts. It verifies:

- Docker CLI and Docker `buildx` are available.
- AWS CLI can resolve the caller identity.
- The optional `AWS_ACCOUNT_ID` matches the authenticated AWS account.
- Docker can authenticate to the resolved ECR registry using `aws ecr get-login-password` piped to `docker login --password-stdin`; the password is not printed.
- ECR repositories for the app and ingester are reachable.
- ECS services in the configured cluster are reachable.
- The current task definitions for the app and ingester services are readable and include the expected app and ingester containers.
- Required Secrets Manager secret name/ARN metadata for the webhook encryption key, tracking secret, ingester job token, and ingester inbound token is resolvable without fetching values.

If the preflight fails, do not deploy. Fix the failing tool, auth, account, network, repository, service, or secret-name issue first.

## Fallback deploy flow

1. Confirm the Mac mini runner outage or self-hosted runner unavailability is the blocker. Do not use this path for routine deploys while the normal runner is healthy.
2. Fetch and inspect the intended production SHA:

   ```bash
   git fetch origin main staging
   git status -sb
   git rev-parse HEAD
   git diff --check HEAD
   ```

3. Export only non-secret overrides if needed. Prefer setting `AWS_ACCOUNT_ID` as an account guard:

   ```bash
   export AWS_REGION=us-east-1
   export AWS_ACCOUNT_ID=<production-account-id>
   export ECS_CLUSTER=namuh
   export PRODUCT=opensend
   export PLATFORM=linux/amd64
   ```

4. Run the preflight:

   ```bash
   bun run deploy:fallback:preflight
   ```

5. Deploy with the same primitive used by `.github/workflows/deploy.yml`:

   ```bash
   bash scripts/deploy.sh all
   ```

6. Save the terminal output in an operator-private location if needed. Do not paste secrets, AWS credential env vars, or full environment dumps into GitHub.

## Verification and rollback

After `bash scripts/deploy.sh all` finishes, verify:

```bash
aws ecs describe-services \
  --region "${AWS_REGION:-us-east-1}" \
  --cluster "${ECS_CLUSTER:-namuh}" \
  --services "${PRODUCT:-opensend}-app" "${PRODUCT:-opensend}-ingester" \
  --query 'services[].{service:serviceName,status:status,desired:desiredCount,running:runningCount,taskDefinition:taskDefinition}' \
  --output table
```

Also check the public endpoints printed by `scripts/deploy.sh` and the recent ECS/CloudWatch events for both services.

Rollback is currently the same as the normal ECS image rollback process: identify the previous known-good image/task definition from ECR/ECS history, update the affected service back to that task definition or image, and wait for ECS stability. Record the task definitions and SHAs involved before and after rollback. If migrations ran, evaluate database compatibility before rolling back app code.

## Recording a no-op fallback deploy exercise

Before declaring issue #645 fully closed, run one real no-op fallback deploy from a non-Mac-mini machine against the current production SHA. This is intentionally outside this PR because it mutates production by pushing images and forcing ECS deployments.

Record the exercise in issue #645 or in this runbook with:

- Date/time and operator.
- Source machine type, explicitly noting it was not the Mac mini runner.
- Git SHA deployed.
- Preflight result.
- `bash scripts/deploy.sh all` result.
- ECS service stability result.
- Any rollback or follow-up required.

Until that exercise is recorded, this runbook and preflight provide a documented break-glass path, but the production deploy SPOF is not proven fully closed.
