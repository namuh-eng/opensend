#!/usr/bin/env bash
# ABOUTME: Build, push, and redeploy opensend on AWS ECS Fargate.
# ABOUTME: Idempotent. Run anytime to ship the current branch to prod.
#
# Usage:
#   bash scripts/deploy.sh                  # app, ingester, and scheduler
#   bash scripts/deploy.sh app              # just the app
#   bash scripts/deploy.sh ingester         # just the ingester
#   bash scripts/deploy.sh scheduler        # just the scheduler
#   bash scripts/deploy.sh migrate          # just run database migrations
#
# Requires: docker (with buildx), aws CLI, AWS creds with ECR + ECS permissions.
# Assumes infra has been bootstrapped (see scripts/aws-bootstrap.sh).

set -euo pipefail
cd "$(dirname "$0")/.."

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)}"
if [[ -z "${AWS_ACCOUNT_ID:-}" ]]; then
  echo "AWS_ACCOUNT_ID not set and 'aws sts get-caller-identity' failed." >&2
  echo "Run 'aws configure' or export AWS_ACCOUNT_ID." >&2
  exit 1
fi
PRODUCT="${PRODUCT:-opensend}"
CLUSTER="${ECS_CLUSTER:-namuh}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"

ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

APP_REPO="${PRODUCT}-app"
APP_SERVICE="${PRODUCT}-app"
APP_CONTAINER_NAME="${APP_CONTAINER_NAME:-${PRODUCT}-app}"
APP_DOCKERFILE="${APP_DOCKERFILE:-Dockerfile}"
APP_TARGET="${APP_TARGET:-runner}"
APP_MIGRATOR_TARGET="${APP_MIGRATOR_TARGET:-migrator}"
MIGRATOR_IMAGE_TAG="${MIGRATOR_IMAGE_TAG:-${IMAGE_TAG}-migrator}"
MIGRATOR_TASK_FAMILY="${MIGRATOR_TASK_FAMILY:-${PRODUCT}-migrator}"
APP_LOG_GROUP="${APP_LOG_GROUP:-/ecs/${APP_SERVICE}}"
APP_LOG_STREAM_PREFIX="${APP_LOG_STREAM_PREFIX:-app}"
WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID="${WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID:-${PRODUCT}/webhook/secret-encryption-key}"
WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN="${WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN:-}"

ING_REPO="${PRODUCT}-ingester"
ING_SERVICE="${PRODUCT}-ingester"
ING_CONTAINER_NAME="${ING_CONTAINER_NAME:-${PRODUCT}-ingester}"
ING_DOCKERFILE="${ING_DOCKERFILE:-packages/ingester/Dockerfile}"
INGESTER_JOB_TOKEN_SECRET_ID="${INGESTER_JOB_TOKEN_SECRET_ID:-${PRODUCT}/ingester-job-token}"
INGESTER_JOB_TOKEN_SECRET_ARN="${INGESTER_JOB_TOKEN_SECRET_ARN:-}"

SCHED_SERVICE="${SCHED_SERVICE:-${PRODUCT}-scheduler}"
SCHED_CONTAINER_NAME="${SCHED_CONTAINER_NAME:-${PRODUCT}-scheduler}"
SCHED_TASK_FAMILY="${SCHED_TASK_FAMILY:-${PRODUCT}-scheduler}"
SCHED_CPU="${SCHED_CPU:-256}"
SCHED_MEMORY="${SCHED_MEMORY:-512}"
SCHED_LOG_GROUP="${SCHED_LOG_GROUP:-/ecs/${SCHED_SERVICE}}"
SCHED_LOG_STREAM_PREFIX="${SCHED_LOG_STREAM_PREFIX:-scheduler}"
SCHED_INGESTER_URL="${SCHED_INGESTER_URL:-https://events.${PRODUCT}.namuh.co}"
SCHED_INTERVAL_SECONDS="${SCHED_INTERVAL_SECONDS:-60}"

color() { printf "\033[1;%sm%s\033[0m\n" "$1" "$2"; }
info()  { color 36 "$*"; }
ok()    { color 32 "$*"; }
warn()  { color 33 "$*"; }
err()   { color 31 "$*" >&2; }

build_and_push() {
  local repo="$1" dockerfile="$2" target="${3:-}" tag="${4:-${IMAGE_TAG}}"
  local image="${ECR_BASE}/${repo}:${tag}"

  info "→ Build & push ${repo}"
  echo "  image:      ${image}"
  echo "  dockerfile: ${dockerfile}"
  echo "  platform:   ${PLATFORM}"
  [[ -n "${target}" ]] && echo "  target:     ${target}"

  local args=(buildx build --platform "${PLATFORM}" -f "${dockerfile}" -t "${image}" --push)
  [[ -n "${target}" ]] && args+=(--target "${target}")

  # Plumb NEXT_PUBLIC_* observability vars through to the builder stage so they
  # get inlined into the client JS bundle. Optional — empty means no-op client.
  for build_arg in \
    NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST \
    SENTRY_ENVIRONMENT \
    SENTRY_RELEASE; do
    if [[ -n "${!build_arg:-}" ]]; then
      args+=(--build-arg "${build_arg}=${!build_arg}")
    fi
  done

  args+=(.)

  docker "${args[@]}"
  ok "  pushed ${image}"
}

app_task_definition() {
  aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${APP_SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'services[0].taskDefinition' \
    --output text
}

webhook_secret_encryption_key_secret_arn() {
  if [[ -n "${WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN}" ]]; then
    printf "%s\n" "${WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN}"
    return
  fi

  aws secretsmanager describe-secret \
    --secret-id "${WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID}" \
    --region "${AWS_REGION}" \
    --query 'ARN' \
    --output text
}

ingester_job_token_secret_arn() {
  if [[ -n "${INGESTER_JOB_TOKEN_SECRET_ARN}" ]]; then
    printf "%s\n" "${INGESTER_JOB_TOKEN_SECRET_ARN}"
    return
  fi

  aws secretsmanager describe-secret \
    --secret-id "${INGESTER_JOB_TOKEN_SECRET_ID}" \
    --region "${AWS_REGION}" \
    --query 'ARN' \
    --output text
}

write_service_network_configuration() {
  local output_file="$1" service="${2:-${APP_SERVICE}}"

  aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${service}" \
    --region "${AWS_REGION}" \
    --query 'services[0].networkConfiguration' \
    --output json > "${output_file}"
}

write_app_task_definition() {
  local base_task_definition="$1" app_image="$2" webhook_secret_arn="$3" output_file="$4"
  local base_task_file
  base_task_file="$(mktemp)"

  aws ecs describe-task-definition \
    --task-definition "${base_task_definition}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition' \
    --output json > "${base_task_file}"

  python3 - "${base_task_file}" "${app_image}" "${APP_CONTAINER_NAME}" "${webhook_secret_arn}" > "${output_file}" <<'PY'
import copy
import json
import sys

base_task_file, app_image, container_name, webhook_secret_arn = sys.argv[1:5]
with open(base_task_file, "r", encoding="utf-8") as handle:
    task = json.load(handle)

allowed_task_keys = [
    "taskRoleArn",
    "executionRoleArn",
    "networkMode",
    "volumes",
    "placementConstraints",
    "requiresCompatibilities",
    "cpu",
    "memory",
    "runtimePlatform",
    "ephemeralStorage",
    "proxyConfiguration",
    "inferenceAccelerators",
    "pidMode",
    "ipcMode",
]

definition = {"family": task.get("family")}
for key in allowed_task_keys:
    value = task.get(key)
    if value not in (None, [], {}):
        definition[key] = value

containers = copy.deepcopy(task.get("containerDefinitions") or [])
selected = next(
    (container for container in containers if container.get("name") == container_name),
    None,
)
if selected is None:
    raise SystemExit(f"base task definition has no {container_name!r} container")

selected["image"] = app_image
secrets = selected.setdefault("secrets", [])
required_secret = {
    "name": "WEBHOOK_SECRET_ENCRYPTION_KEY",
    "valueFrom": webhook_secret_arn,
}
for index, secret in enumerate(secrets):
    if secret.get("name") == required_secret["name"]:
        secrets[index] = required_secret
        break
else:
    secrets.append(required_secret)

definition["containerDefinitions"] = containers
json.dump(definition, sys.stdout)
PY
}

register_app_task_definition() {
  local app_image="$1" base_task_definition webhook_secret_arn task_file
  base_task_definition="$(app_task_definition)"
  webhook_secret_arn="$(webhook_secret_encryption_key_secret_arn)"
  task_file="$(mktemp)"

  write_app_task_definition "${base_task_definition}" "${app_image}" "${webhook_secret_arn}" "${task_file}"

  aws ecs register-task-definition \
    --cli-input-json "file://${task_file}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
}

ingester_task_definition() {
  aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${ING_SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'services[0].taskDefinition' \
    --output text
}

write_ingester_task_definition() {
  local base_task_definition="$1" ingester_image="$2" job_token_arn="$3" output_file="$4"
  local base_task_file
  base_task_file="$(mktemp)"

  aws ecs describe-task-definition \
    --task-definition "${base_task_definition}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition' \
    --output json > "${base_task_file}"

  python3 - "${base_task_file}" "${ingester_image}" "${ING_CONTAINER_NAME}" "${job_token_arn}" > "${output_file}" <<'PY'
import copy
import json
import sys

base_task_file, ingester_image, container_name, job_token_arn = sys.argv[1:5]
with open(base_task_file, "r", encoding="utf-8") as handle:
    task = json.load(handle)

allowed_task_keys = [
    "taskRoleArn",
    "executionRoleArn",
    "networkMode",
    "volumes",
    "placementConstraints",
    "requiresCompatibilities",
    "cpu",
    "memory",
    "runtimePlatform",
    "ephemeralStorage",
    "proxyConfiguration",
    "inferenceAccelerators",
    "pidMode",
    "ipcMode",
]

definition = {"family": task.get("family")}
for key in allowed_task_keys:
    value = task.get(key)
    if value not in (None, [], {}):
        definition[key] = value

containers = copy.deepcopy(task.get("containerDefinitions") or [])
selected = next(
    (container for container in containers if container.get("name") == container_name),
    None,
)
if selected is None:
    raise SystemExit(f"base task definition has no {container_name!r} container")

selected["image"] = ingester_image

environment = selected.setdefault("environment", [])
required_environment = {
    "NODE_ENV": "production",
    "HOST": "0.0.0.0",
}
for name, value in required_environment.items():
    for item in environment:
        if item.get("name") == name:
            item["value"] = value
            break
    else:
        environment.append({"name": name, "value": value})

secrets = selected.setdefault("secrets", [])
required_secret = {
    "name": "INGESTER_JOB_TOKEN",
    "valueFrom": job_token_arn,
}
for index, secret in enumerate(secrets):
    if secret.get("name") == required_secret["name"]:
        secrets[index] = required_secret
        break
else:
    secrets.append(required_secret)

definition["containerDefinitions"] = containers
json.dump(definition, sys.stdout)
PY
}

register_ingester_task_definition() {
  local ingester_image="$1" base_task_definition job_token_arn task_file
  base_task_definition="$(ingester_task_definition)"
  job_token_arn="$(ingester_job_token_secret_arn)"
  task_file="$(mktemp)"

  write_ingester_task_definition "${base_task_definition}" "${ingester_image}" "${job_token_arn}" "${task_file}"

  aws ecs register-task-definition \
    --cli-input-json "file://${task_file}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
}

create_log_group_if_missing() {
  local log_group="$1"

  aws logs create-log-group \
    --log-group-name "${log_group}" \
    --region "${AWS_REGION}" 2>/dev/null || true
}

write_scheduler_task_definition() {
  local base_task_definition="$1" scheduler_image="$2" job_token_arn="$3" output_file="$4"
  local base_task_file
  base_task_file="$(mktemp)"

  aws ecs describe-task-definition \
    --task-definition "${base_task_definition}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition' \
    --output json > "${base_task_file}"

  python3 - \
    "${base_task_file}" \
    "${scheduler_image}" \
    "${SCHED_TASK_FAMILY}" \
    "${ING_CONTAINER_NAME}" \
    "${SCHED_CONTAINER_NAME}" \
    "${job_token_arn}" \
    "${SCHED_CPU}" \
    "${SCHED_MEMORY}" \
    "${SCHED_LOG_GROUP}" \
    "${AWS_REGION}" \
    "${SCHED_LOG_STREAM_PREFIX}" \
    "${SCHED_INGESTER_URL}" \
    "${SCHED_INTERVAL_SECONDS}" \
    > "${output_file}" <<'PY'
import copy
import json
import sys

(
    base_task_file,
    scheduler_image,
    family,
    ingester_container_name,
    scheduler_container_name,
    job_token_arn,
    cpu,
    memory,
    log_group,
    aws_region,
    log_stream_prefix,
    ingester_url,
    interval_seconds,
) = sys.argv[1:14]

with open(base_task_file, "r", encoding="utf-8") as handle:
    task = json.load(handle)

allowed_task_keys = [
    "taskRoleArn",
    "executionRoleArn",
    "networkMode",
    "volumes",
    "placementConstraints",
    "requiresCompatibilities",
    "runtimePlatform",
    "ephemeralStorage",
    "proxyConfiguration",
    "inferenceAccelerators",
    "pidMode",
    "ipcMode",
]

definition = {
    "family": family,
    "cpu": cpu,
    "memory": memory,
}
for key in allowed_task_keys:
    value = task.get(key)
    if value not in (None, [], {}):
        definition[key] = value

containers = task.get("containerDefinitions") or []
selected = next(
    (
        container
        for container in containers
        if container.get("name") == ingester_container_name
    ),
    containers[0] if containers else None,
)
if selected is None:
    raise SystemExit("base task definition has no containers")

scheduler = copy.deepcopy(selected)
scheduler["name"] = scheduler_container_name
scheduler["image"] = scheduler_image
scheduler["essential"] = True
scheduler["command"] = ["bun", "/app/job-scheduler.js"]
scheduler.pop("portMappings", None)
scheduler.pop("healthCheck", None)

scheduler["environment"] = [
    {"name": "NODE_ENV", "value": "production"},
    {"name": "INGESTER_URL", "value": ingester_url},
    {"name": "INGESTER_SCHEDULER_INTERVAL_SECONDS", "value": interval_seconds},
]

base_secrets = {
    secret.get("name"): secret
    for secret in (selected.get("secrets") or [])
    if secret.get("name")
}
required_secret_names = ["DATABASE_URL", "BETTER_AUTH_SECRET", "INGESTER_JOB_TOKEN"]
optional_secret_names = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
if "DATABASE_URL" not in base_secrets:
    raise SystemExit("base ingester task definition has no DATABASE_URL secret")
if "BETTER_AUTH_SECRET" not in base_secrets:
    raise SystemExit("base ingester task definition has no BETTER_AUTH_SECRET secret")

scheduler["secrets"] = []
for name in required_secret_names + [
    name for name in optional_secret_names if name in base_secrets
]:
    if name == "INGESTER_JOB_TOKEN":
        scheduler["secrets"].append({"name": name, "valueFrom": job_token_arn})
    else:
        scheduler["secrets"].append(copy.deepcopy(base_secrets[name]))

scheduler["logConfiguration"] = {
    "logDriver": "awslogs",
    "options": {
        "awslogs-group": log_group,
        "awslogs-region": aws_region,
        "awslogs-stream-prefix": log_stream_prefix,
    },
}

definition["containerDefinitions"] = [scheduler]
json.dump(definition, sys.stdout)
PY
}

register_scheduler_task_definition() {
  local scheduler_image="$1" base_task_definition job_token_arn task_file
  base_task_definition="$(ingester_task_definition)"
  job_token_arn="$(ingester_job_token_secret_arn)"
  task_file="$(mktemp)"

  write_scheduler_task_definition "${base_task_definition}" "${scheduler_image}" "${job_token_arn}" "${task_file}"

  aws ecs register-task-definition \
    --cli-input-json "file://${task_file}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
}

scheduler_service_exists() {
  local status
  status="$(aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${SCHED_SERVICE}" \
    --region "${AWS_REGION}" \
    --query 'services[0].status' \
    --output text 2>/dev/null || true)"

  [[ "${status}" == "ACTIVE" || "${status}" == "DRAINING" ]]
}

create_or_redeploy_scheduler_service() {
  local task_definition="$1" network_file

  network_file="$(mktemp)"
  write_service_network_configuration "${network_file}" "${ING_SERVICE}"

  if scheduler_service_exists; then
    redeploy "${SCHED_SERVICE}" "${task_definition}"
    return
  fi

  info "→ Create ECS service: ${SCHED_SERVICE}"
  aws ecs create-service \
    --cluster "${CLUSTER}" \
    --service-name "${SCHED_SERVICE}" \
    --task-definition "${task_definition}" \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "file://${network_file}" \
    --region "${AWS_REGION}" \
    --query 'service.{status:status,desired:desiredCount,running:runningCount}' \
    --output table
}

write_migrator_task_definition() {
  local base_task_definition="$1" migrator_image="$2" output_file="$3"
  local base_task_file
  base_task_file="$(mktemp)"

  aws ecs describe-task-definition \
    --task-definition "${base_task_definition}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition' \
    --output json > "${base_task_file}"

  python3 - "${base_task_file}" "${migrator_image}" "${MIGRATOR_TASK_FAMILY}" "${APP_CONTAINER_NAME}" > "${output_file}" <<'PY'
import copy
import json
import sys

base_task_file, migrator_image, family, container_name = sys.argv[1:5]
with open(base_task_file, "r", encoding="utf-8") as handle:
    task = json.load(handle)

allowed_task_keys = [
    "taskRoleArn",
    "executionRoleArn",
    "networkMode",
    "volumes",
    "placementConstraints",
    "requiresCompatibilities",
    "cpu",
    "memory",
    "runtimePlatform",
    "ephemeralStorage",
    "proxyConfiguration",
    "inferenceAccelerators",
    "pidMode",
    "ipcMode",
]

definition = {"family": family}
for key in allowed_task_keys:
    value = task.get(key)
    if value not in (None, [], {}):
        definition[key] = value

containers = task.get("containerDefinitions") or []
selected = next(
    (container for container in containers if container.get("name") == container_name),
    containers[0] if containers else None,
)
if selected is None:
    raise SystemExit("base task definition has no containers")

migrator = copy.deepcopy(selected)
migrator["image"] = migrator_image
migrator["essential"] = True

# The migration image has its own CMD. App serving concerns should not leak into
# the one-off task because health checks and ports can race a short-lived job.
for key in ("command", "entryPoint", "portMappings", "healthCheck"):
    migrator.pop(key, None)

definition["containerDefinitions"] = [migrator]
json.dump(definition, sys.stdout)
PY
}

register_migrator_task_definition() {
  local migrator_image="$1" base_task_definition task_file
  base_task_definition="$(app_task_definition)"
  task_file="$(mktemp)"

  write_migrator_task_definition "${base_task_definition}" "${migrator_image}" "${task_file}"

  aws ecs register-task-definition \
    --cli-input-json "file://${task_file}" \
    --region "${AWS_REGION}" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
}

show_migrator_logs() {
  local task_arn="$1"
  local task_id="${task_arn##*/}"
  local log_stream="${APP_LOG_STREAM_PREFIX}/${APP_CONTAINER_NAME}/${task_id}"

  aws logs get-log-events \
    --log-group-name "${APP_LOG_GROUP}" \
    --log-stream-name "${log_stream}" \
    --region "${AWS_REGION}" \
    --query 'events[].message' \
    --output text 2>/dev/null || true
}

run_migrations() {
  local migrator_image="${ECR_BASE}/${APP_REPO}:${MIGRATOR_IMAGE_TAG}"
  local network_file run_output task_arn exit_code stopped_reason

  build_and_push "${APP_REPO}" "${APP_DOCKERFILE}" "${APP_MIGRATOR_TARGET}" "${MIGRATOR_IMAGE_TAG}"

  info "→ Register ECS migrator task definition"
  local migrator_task_definition
  migrator_task_definition="$(register_migrator_task_definition "${migrator_image}")"
  ok "  registered ${migrator_task_definition}"

  network_file="$(mktemp)"
  write_service_network_configuration "${network_file}"

  info "→ Run database migrations"
  run_output="$(aws ecs run-task \
    --cluster "${CLUSTER}" \
    --task-definition "${migrator_task_definition}" \
    --launch-type FARGATE \
    --network-configuration "file://${network_file}" \
    --region "${AWS_REGION}" \
    --query '{task:tasks[0].taskArn,failures:failures}' \
    --output json)"

  task_arn="$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("task") or "")' <<< "${run_output}")"
  if [[ -z "${task_arn}" ]]; then
    err "  migration task failed to start:"
    echo "${run_output}" >&2
    exit 1
  fi

  echo "  task: ${task_arn}"
  aws ecs wait tasks-stopped \
    --cluster "${CLUSTER}" \
    --tasks "${task_arn}" \
    --region "${AWS_REGION}"

  exit_code="$(aws ecs describe-tasks \
    --cluster "${CLUSTER}" \
    --tasks "${task_arn}" \
    --region "${AWS_REGION}" \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)"
  stopped_reason="$(aws ecs describe-tasks \
    --cluster "${CLUSTER}" \
    --tasks "${task_arn}" \
    --region "${AWS_REGION}" \
    --query 'tasks[0].stoppedReason' \
    --output text)"

  if [[ "${exit_code}" != "0" ]]; then
    err "  migration task failed (exit ${exit_code}): ${stopped_reason}"
    show_migrator_logs "${task_arn}" >&2
    exit 1
  fi

  show_migrator_logs "${task_arn}" || true
  ok "  migrations complete"
}

redeploy() {
  local service="$1" task_definition="${2:-}"
  info "→ Force redeploy ECS service: ${service}"
  local args=(
    ecs update-service
    --cluster "${CLUSTER}" \
    --service "${service}" \
    --force-new-deployment \
    --region "${AWS_REGION}"
  )
  if [[ -n "${task_definition}" ]]; then
    args+=(--task-definition "${task_definition}")
  fi
  args+=(
    --query 'service.deployments[0].{status:status,desired:desiredCount}' \
    --output table
  )
  aws "${args[@]}"
}

wait_stable() {
  local service="$1"
  info "→ Wait for ${service} to stabilize (this can take a few minutes)"
  if aws ecs wait services-stable \
    --cluster "${CLUSTER}" \
    --services "${service}" \
    --region "${AWS_REGION}"; then
    ok "  ${service} is stable"
  else
    err "  ${service} did not stabilize. Recent events:"
    aws ecs describe-services \
      --cluster "${CLUSTER}" \
      --services "${service}" \
      --region "${AWS_REGION}" \
      --query 'services[0].events[0:5].message' \
      --output table || true
    return 1
  fi
}

deploy_app() {
  local app_image="${ECR_BASE}/${APP_REPO}:${IMAGE_TAG}"
  build_and_push "${APP_REPO}" "${APP_DOCKERFILE}" "${APP_TARGET}"

  info "→ Register ECS app task definition"
  APP_TASK_DEFINITION="$(register_app_task_definition "${app_image}")"
  ok "  registered ${APP_TASK_DEFINITION}"
}

deploy_ingester() {
  local ingester_image="${ECR_BASE}/${ING_REPO}:${IMAGE_TAG}"
  build_and_push "${ING_REPO}" "${ING_DOCKERFILE}" ""

  info "→ Register ECS ingester task definition"
  ING_TASK_DEFINITION="$(register_ingester_task_definition "${ingester_image}")"
  ok "  registered ${ING_TASK_DEFINITION}"
}

deploy_scheduler() {
  local scheduler_image="${ECR_BASE}/${ING_REPO}:${IMAGE_TAG}"

  build_and_push "${ING_REPO}" "${ING_DOCKERFILE}" ""
  create_log_group_if_missing "${SCHED_LOG_GROUP}"

  info "→ Register ECS scheduler task definition"
  SCHED_TASK_DEFINITION="$(register_scheduler_task_definition "${scheduler_image}")"
  ok "  registered ${SCHED_TASK_DEFINITION}"
}

target="${1:-all}"

case "${target}" in
  app)
    deploy_app
    run_migrations
    redeploy "${APP_SERVICE}" "${APP_TASK_DEFINITION}"
    wait_stable "${APP_SERVICE}"
    ;;
  ingester)
    deploy_ingester
    run_migrations
    redeploy "${ING_SERVICE}" "${ING_TASK_DEFINITION}"
    wait_stable "${ING_SERVICE}"
    ;;
  scheduler)
    deploy_scheduler
    create_or_redeploy_scheduler_service "${SCHED_TASK_DEFINITION}"
    wait_stable "${SCHED_SERVICE}"
    ;;
  migrate)
    run_migrations
    ;;
  all)
    deploy_app
    deploy_ingester
    deploy_scheduler
    run_migrations
    redeploy "${APP_SERVICE}" "${APP_TASK_DEFINITION}"
    redeploy "${ING_SERVICE}" "${ING_TASK_DEFINITION}"
    create_or_redeploy_scheduler_service "${SCHED_TASK_DEFINITION}"
    wait_stable "${APP_SERVICE}" &
    APP_PID=$!
    wait_stable "${ING_SERVICE}" &
    ING_PID=$!
    wait_stable "${SCHED_SERVICE}" &
    SCHED_PID=$!
    APP_RC=0; ING_RC=0; SCHED_RC=0
    wait "${APP_PID}" || APP_RC=$?
    wait "${ING_PID}" || ING_RC=$?
    wait "${SCHED_PID}" || SCHED_RC=$?
    if [[ "${APP_RC}" -ne 0 || "${ING_RC}" -ne 0 || "${SCHED_RC}" -ne 0 ]]; then
      err "One or more services failed to stabilize."
      exit 1
    fi
    ;;
  *)
    err "Unknown target: ${target} (expected: app | ingester | scheduler | migrate | all)"
    exit 2
    ;;
esac

ok "✓ Deploy complete: ${PRODUCT} (${target})"
echo
echo "App:      https://${PRODUCT}.namuh.co"
echo "API:      https://api.${PRODUCT}.namuh.co"
echo "Events:   https://events.${PRODUCT}.namuh.co"
echo "Health:   https://${PRODUCT}.namuh.co/api/health/scheduler"
