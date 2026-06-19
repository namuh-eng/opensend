// ABOUTME: Static deployment tests for the app + ingester ECS Fargate split
// ABOUTME: Verifies repo-visible Docker, compose, deploy script, and runbook wiring

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

function serviceBlock(compose: string, serviceName: string): string {
  const escapedServiceName = serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = compose.match(
    new RegExp(
      `\\n  ${escapedServiceName}:\\n[\\s\\S]*?(?=\\n  [a-zA-Z0-9_-]+:\\n|\\nvolumes:\\n|$)`,
    ),
  );
  expect(match).not.toBeNull();
  return match?.[0] ?? "";
}

describe("deploy-001: ECS Fargate deployment configuration", () => {
  it("next.config.js has standalone output for Docker deployment", () => {
    const config = readFileSync(join(root, "next.config.js"), "utf-8");
    expect(config).toContain('output: "standalone"');
  });

  it("allows PostHog browser assets in the production CSP", () => {
    const config = readFileSync(join(root, "next.config.js"), "utf-8");
    expect(config).toContain("https://us-assets.i.posthog.com");
    expect(config).toContain("connect-src 'self' https:");
  });

  it("Dockerfile exists with multi-stage build", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("FROM oven/bun:1.3.8-alpine AS base");
    expect(dockerfile).toContain("AS deps");
    expect(dockerfile).toContain("AS builder");
    expect(dockerfile).toContain("AS runner");
    expect(dockerfile).toContain("bun run build");
    expect(dockerfile).toContain(".next/standalone");
  });

  it("Dockerfile exposes port 8080 for Fargate", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("EXPOSE 8080");
    expect(dockerfile).toContain("ENV PORT=8080");
  });

  it("Dockerfile includes a migration runner image", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("FROM base AS migrator");
    expect(dockerfile).toContain("COPY drizzle ./drizzle");
    expect(dockerfile).toContain("COPY src/lib/db/migrate.ts");
    expect(dockerfile).toContain('CMD ["bun", "src/lib/db/migrate.ts"]');
  });

  it("deploy script builds, pushes, and force-redeploys ECS services", () => {
    const scriptPath = join(root, "scripts", "deploy.sh");
    expect(existsSync(scriptPath)).toBe(true);
    const script = readFileSync(scriptPath, "utf-8");
    expect(script).toContain("buildx build");
    expect(script).toContain("linux/amd64");
    expect(script).toContain("ecs update-service");
    expect(script).toContain("--force-new-deployment");
    expect(script).toContain("aws ecs wait services-stable");
  });

  it("deploy script injects required production app secrets into ECS task definitions", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain("WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID");
    expect(script).toContain("TRACKING_SECRET_SECRET_ID");
    expect(script).toContain("aws secretsmanager describe-secret");
    expect(script).toContain('"name": "WEBHOOK_SECRET_ENCRYPTION_KEY"');
    expect(script).toContain('"name": "TRACKING_SECRET"');
    expect(script).toContain("register_app_task_definition");
    expect(script).toContain(
      'redeploy "${APP_SERVICE}" "${APP_TASK_DEFINITION}"',
    );
  });

  it("deploy script injects the SES events SNS topic ARN into the app task environment when configured", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain(
      'SES_EVENTS_SNS_TOPIC_ARN="${SES_EVENTS_SNS_TOPIC_ARN:-}"',
    );
    expect(script).toContain(
      'SES_INBOUND_SNS_TOPIC_ARN="${SES_INBOUND_SNS_TOPIC_ARN:-}"',
    );
    expect(script).toContain(
      'SES_INBOUND_SNS_TOPIC_ARNS="${SES_INBOUND_SNS_TOPIC_ARNS:-}"',
    );
    expect(script).toContain('"name": topic_name');
    expect(script).toContain('"value": topic_value');
    expect(script).toContain('"SES_EVENTS_SNS_TOPIC_ARN"');
    expect(script).toContain('"SES_INBOUND_SNS_TOPIC_ARN"');
    expect(script).toContain('"SES_INBOUND_SNS_TOPIC_ARNS"');
    expect(script).toContain('"${SES_EVENTS_SNS_TOPIC_ARN}"');
    expect(script).toContain('"${SES_INBOUND_SNS_TOPIC_ARN}"');
    expect(script).toContain('"${SES_INBOUND_SNS_TOPIC_ARNS}"');
    expect(script).toContain('"${task_file}"');
  });

  it("deploy script injects the SES events SNS topic ARN into the ingester task environment", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain(
      'write_ingester_task_definition \\\n    "${base_task_definition}" \\\n    "${ingester_image}"',
    );
    expect(script).toContain('"${SES_EVENTS_SNS_TOPIC_ARN}"');
    expect(script).toContain('"${SES_INBOUND_SNS_TOPIC_ARN}"');
    expect(script).toContain('"${SES_INBOUND_SNS_TOPIC_ARNS}"');
    expect(script).toContain('"${task_file}"');
    expect(script).toContain('"SES_INBOUND_SNS_TOPIC_ARN",');
    expect(script).toContain('"SES_INBOUND_SNS_TOPIC_ARNS",');
    expect(script).toContain(
      'required_environment["SES_EVENTS_SNS_TOPIC_ARN"] = ses_events_sns_topic_arn',
    );
    expect(script).toContain(
      'required_environment["SES_INBOUND_SNS_TOPIC_ARN"] = ses_inbound_sns_topic_arn',
    );
    expect(script).toContain(
      'required_environment["SES_INBOUND_SNS_TOPIC_ARNS"] = ses_inbound_sns_topic_arns',
    );
  });

  it("deploy script carries receiving storage config into the ingester task definition", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain("INGESTER_INBOUND_TOKEN_SECRET_ID");
    expect(script).toContain("ingester_inbound_token_secret_arn");
    expect(script).toContain('"name": "INGESTER_INBOUND_TOKEN"');
    expect(script).toContain('"SES_INBOUND_SNS_TOPIC_ARN",');
    expect(script).toContain('"SES_INBOUND_SNS_TOPIC_ARNS",');
    expect(script).toContain('"SES_INBOUND_BUCKET_NAME"');
    expect(script).toContain("app_task_definition");
  });

  it("deploy script runs migrations before ECS service redeploys", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain("bash scripts/deploy.sh migrate");
    expect(script).toContain("APP_MIGRATOR_TARGET");
    expect(script).toContain("aws ecs register-task-definition");
    expect(script).toContain("aws ecs run-task");

    const allDeployBlock = script.slice(
      script.indexOf("  all)"),
      script.indexOf("  *)"),
    );
    expect(allDeployBlock.indexOf("run_migrations")).toBeGreaterThan(-1);
    expect(allDeployBlock.indexOf("redeploy")).toBeGreaterThan(-1);
    expect(allDeployBlock.indexOf("run_migrations")).toBeLessThan(
      allDeployBlock.indexOf("redeploy"),
    );
  });

  it("has an idempotent repair migration for production domain columns", () => {
    const migration = readFileSync(
      join(root, "drizzle", "0010_repair_domain_columns.sql"),
      "utf-8",
    );
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "email_events"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "received_emails"');
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "webhook_deliveries"',
    );
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "custom_return_path"',
    );
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "tracking_subdomain"',
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "capabilities"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "sent_at"');
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
  });

  it("package.json has build scripts for the app and ingester", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    expect(pkg.scripts.build).toBe("next build");
    expect(pkg.scripts["build:ingester"]).toContain(
      "packages/ingester/src/server.ts",
    );
    expect(pkg.scripts["start:ingester"]).toBe(
      "bun ./packages/ingester/src/server.ts",
    );
  });

  it(".dockerignore excludes node_modules and .next", () => {
    const ignore = readFileSync(join(root, ".dockerignore"), "utf-8");
    expect(ignore).toContain("node_modules");
    expect(ignore).toContain(".next");
  });

  it("docker-compose pins release images for app, ingester, and scheduler by default", () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf-8");
    const app = serviceBlock(compose, "app");
    const ingester = serviceBlock(compose, "ingester");
    const scheduler = serviceBlock(compose, "scheduler");

    expect(app).toContain("image: ghcr.io/namuh-eng/opensend:v1.0.0");
    expect(app).not.toContain("build:");
    expect(ingester).toContain(
      "image: ghcr.io/namuh-eng/opensend-ingester:v1.0.0",
    );
    expect(ingester).not.toContain("build:");
    expect(ingester).toContain("INGESTER_PORT:-3016");
    expect(ingester).toContain("http://127.0.0.1:3016/health");
    expect(scheduler).toContain(
      "image: ghcr.io/namuh-eng/opensend-ingester:v1.0.0",
    );
    expect(scheduler).toContain('command: ["bun", "/app/job-scheduler.js"]');
  });

  it("docker-compose local override builds the app and ingester from source", () => {
    const override = readFileSync(
      join(root, "docker-compose.local.yml"),
      "utf-8",
    );
    const app = serviceBlock(override, "app");
    const ingester = serviceBlock(override, "ingester");
    const scheduler = serviceBlock(override, "scheduler");

    expect(app).toContain("image: opensend:local");
    expect(app).toContain("target: runner");
    expect(ingester).toContain("image: opensend-ingester:local");
    expect(ingester).toContain("dockerfile: packages/ingester/Dockerfile");
    expect(scheduler).toContain("image: opensend-ingester:local");
    expect(scheduler).toContain("dockerfile: packages/ingester/Dockerfile");
  });

  it("docker-compose wires Redis-backed rate limiting by default", () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf-8");
    expect(compose).toContain("redis:");
    expect(compose).toContain("image: redis:7-alpine");
    expect(compose).toContain("REDIS_URL: ${REDIS_URL:-redis://redis:6379}");
    expect(compose).toContain(
      "RATE_LIMIT_BACKEND: ${RATE_LIMIT_BACKEND:-redis}",
    );
    expect(compose).toContain(
      "OPENSEND_APP_REPLICAS: ${OPENSEND_APP_REPLICAS:-1}",
    );
    expect(compose).toContain("redisdata:");
  });

  it("docker-compose keeps the SMTP relay behind an explicit profile", () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf-8");
    expect(compose).toContain("smtp-relay:");
    expect(compose).toContain('profiles: ["smtp"]');
    expect(compose).toContain("dockerfile: packages/smtp-relay/Dockerfile");
    expect(compose).toContain(
      '"${SMTP_RELAY_PORT:-2587}:${SMTP_RELAY_PORT:-2587}"',
    );
    expect(compose).not.toContain("smtp-relay:\n    image:");
  });

  it("ingester Dockerfile builds a standalone server bundle", () => {
    const dockerfile = readFileSync(
      join(root, "packages", "ingester", "Dockerfile"),
      "utf-8",
    );
    expect(dockerfile).toContain("bun build ./packages/ingester/src/server.ts");
    expect(dockerfile).toContain("--outfile /tmp/ingester-server.js");
    expect(dockerfile).toContain("EXPOSE 3016");
    expect(dockerfile).toContain('CMD ["bun", "/app/server.js"]');
  });

  it("deploy fallback runbook documents the Mac mini outage break-glass path", () => {
    const runbookPath = join(
      root,
      "agent_docs",
      "runbooks",
      "deploy-fallback.md",
    );
    expect(existsSync(runbookPath)).toBe(true);
    const runbook = readFileSync(runbookPath, "utf-8");

    expect(runbook).toContain(".github/workflows/deploy.yml");
    expect(runbook).toContain("scripts/deploy.sh");
    expect(runbook).toContain("Mac mini runner outage");
    expect(runbook).toContain("self-hosted runner unavailability");
    expect(runbook).toContain("bun run deploy:fallback:preflight");
    expect(runbook).toContain("bash scripts/deploy.sh all");
    expect(runbook).toContain("no-op fallback deploy exercise");
    expect(runbook).toContain("not the Mac mini runner");
    expect(runbook).toContain("not proven fully closed");
  });

  it("deploy fallback preflight checks production reachability and Docker ECR auth without pushing", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    expect(pkg.scripts["deploy:fallback:preflight"]).toBe(
      "bun tools/deploy-fallback-preflight.ts",
    );

    const preflight = readFileSync(
      join(root, "tools", "deploy-fallback-preflight.ts"),
      "utf-8",
    );

    expect(preflight).toContain("docker");
    expect(preflight).toContain("buildx");
    expect(preflight).toContain('const region = env.AWS_REGION || "us-east-1"');
    expect(preflight).not.toContain("AWS_DEFAULT_REGION");
    expect(preflight).toContain('"python3", ["--version"]');
    expect(preflight).toContain("get-caller-identity");
    expect(preflight).toContain("get-login-password");
    expect(preflight).toContain("dockerEcrLoginCheck");
    expect(preflight).toContain(
      '"login", "--username", "AWS", "--password-stdin"',
    );
    expect(preflight).toContain("describe-repositories");
    expect(preflight).toContain("describe-services");
    expect(preflight).toContain("describe-task-definition");
    expect(preflight).toContain("ecsTaskDefinitionMetadataCheck");
    expect(preflight).toContain("taskDefinition.family");
    expect(preflight).toContain(
      "containerDefinitions[].{name:name,secrets:secrets[].name,environment:environment[].name}",
    );
    expect(preflight).toContain("appContainerName");
    expect(preflight).toContain("ingesterContainerName");
    expect(preflight).toContain("requiredContainerSecretNames");
    expect(preflight).toContain("requiredContainerEnvironmentOrSecretNames");
    expect(preflight).toContain(`ecsTaskDefinitionMetadataCheck(
      appService,
      appContainerName,
      [],
      ["DATABASE_URL"],
    )`);
    expect(preflight).toContain("environmentNames.has(name)");
    expect(preflight).toContain("secretNames.has(name)");
    expect(preflight).toContain("DATABASE_URL");
    expect(preflight).toContain("BETTER_AUTH_SECRET");
    expect(preflight).toContain("missing required secret metadata");
    expect(preflight).toContain(
      "missing required environment or secret metadata",
    );
    expect(preflight).toContain("App base task required database metadata");
    expect(preflight).toContain("Scheduler base task required secret metadata");
    expect(preflight).toContain("describe-secret");
    expect(preflight).toContain("WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID");
    expect(preflight).toContain("WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN");
    expect(preflight).toContain("TRACKING_SECRET_SECRET_ID");
    expect(preflight).toContain("TRACKING_SECRET_SECRET_ARN");
    expect(preflight).toContain("INGESTER_JOB_TOKEN_SECRET_ID");
    expect(preflight).toContain("INGESTER_JOB_TOKEN_SECRET_ARN");
    expect(preflight).toContain("INGESTER_INBOUND_TOKEN_SECRET_ID");
    expect(preflight).toContain("INGESTER_INBOUND_TOKEN_SECRET_ARN");
    expect(preflight).toContain("Required secret metadata");
    expect(preflight).toContain("the password is not printed");
    expect(preflight).not.toContain("Optional Secrets Manager metadata");
    expect(preflight).toContain("Secret values are not fetched or printed");
    expect(preflight).not.toContain("env.APP_REPO");
    expect(preflight).not.toContain("env.ING_REPO");
    expect(preflight).not.toContain("env.APP_SERVICE");
    expect(preflight).not.toContain("env.ING_SERVICE");

    expect(preflight).not.toContain("environment[].value");
    expect(preflight).not.toContain("get-secret-value");
    expect(preflight).not.toContain("update-service");
    expect(preflight).not.toContain("register-task-definition");
    expect(preflight).not.toContain("run-task");
    expect(preflight).not.toContain("buildx build");
    expect(preflight).not.toContain("--push");
    expect(preflight).not.toContain("get-secret-value");

    const runbook = readFileSync(
      join(root, "agent_docs", "runbooks", "deploy-fallback.md"),
      "utf-8",
    );
    expect(runbook).toContain("aws ecr get-login-password");
    expect(runbook).toContain("python3 --version");
    expect(runbook).toContain("docker login --password-stdin");
    expect(runbook).toContain("does not print the password");
    expect(runbook).toContain("does not push images");
    expect(runbook).toContain("current task definitions");
    expect(runbook).toContain("expected app and ingester containers");
    expect(runbook).toContain(
      "app task definition includes `DATABASE_URL` as an environment variable or secret name",
    );
    expect(runbook).toContain("DATABASE_URL");
    expect(runbook).toContain("BETTER_AUTH_SECRET");
    expect(runbook).toContain("scheduler base task");
    expect(runbook).toContain("does write/refresh the local Docker ECR login");
    expect(runbook).toContain("TRACKING_SECRET_SECRET_ID");
    expect(runbook).toContain("INGESTER_JOB_TOKEN_SECRET_ID");
    expect(runbook).toContain("INGESTER_INBOUND_TOKEN_SECRET_ID");
    expect(runbook).toContain("ingester inbound token");
    expect(runbook).not.toContain(
      "checked by preflight only when explicitly set",
    );
    expect(runbook).toContain(
      "ECR repository and ECS service names are derived",
    );
    expect(runbook).not.toContain("APP_REPO");
    expect(runbook).not.toContain("ING_REPO");
    expect(runbook).not.toContain("APP_SERVICE");
    expect(runbook).not.toContain("ING_SERVICE");
  });

  it("ingester runbook captures the split deploy and operational steps", () => {
    const runbookPath = join(root, "docs", "ingester-deploy.md");
    expect(existsSync(runbookPath)).toBe(true);
    const runbook = readFileSync(runbookPath, "utf-8");
    expect(runbook).toContain("SES SNS should point at");
    expect(runbook).toContain("aws logs tail");
    expect(runbook).toContain("curl -i");
  });
});
