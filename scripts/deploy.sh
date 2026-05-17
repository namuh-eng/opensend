#!/usr/bin/env bash
# ABOUTME: Build, push, and redeploy opensend on AWS ECS Fargate.
# ABOUTME: Idempotent. Run anytime to ship the current branch to prod.
#
# Usage:
#   bash scripts/deploy.sh                  # both app and ingester
#   bash scripts/deploy.sh app              # just the app
#   bash scripts/deploy.sh ingester         # just the ingester
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
ING_DOCKERFILE="${ING_DOCKERFILE:-packages/ingester/Dockerfile}"

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

write_service_network_configuration() {
  local output_file="$1"

  aws ecs describe-services \
    --cluster "${CLUSTER}" \
    --services "${APP_SERVICE}" \
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
  build_and_push "${ING_REPO}" "${ING_DOCKERFILE}" ""
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
    redeploy "${ING_SERVICE}"
    wait_stable "${ING_SERVICE}"
    ;;
  migrate)
    run_migrations
    ;;
  all)
    deploy_app
    deploy_ingester
    run_migrations
    redeploy "${APP_SERVICE}" "${APP_TASK_DEFINITION}"
    redeploy "${ING_SERVICE}"
    wait_stable "${APP_SERVICE}" &
    APP_PID=$!
    wait_stable "${ING_SERVICE}" &
    ING_PID=$!
    APP_RC=0; ING_RC=0
    wait "${APP_PID}" || APP_RC=$?
    wait "${ING_PID}" || ING_RC=$?
    if [[ "${APP_RC}" -ne 0 || "${ING_RC}" -ne 0 ]]; then
      err "One or more services failed to stabilize."
      exit 1
    fi
    ;;
  *)
    err "Unknown target: ${target} (expected: app | ingester | migrate | all)"
    exit 2
    ;;
esac

ok "✓ Deploy complete: ${PRODUCT} (${target})"
echo
echo "App:      https://${PRODUCT}.namuh.co"
echo "API:      https://api.${PRODUCT}.namuh.co"
echo "Events:   https://events.${PRODUCT}.namuh.co"
