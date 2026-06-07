// ABOUTME: Static deployment tests for the app + ingester ECS Fargate split
// ABOUTME: Verifies repo-visible Docker, compose, deploy script, and runbook wiring

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

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
    expect(script).toContain('"name": "SES_EVENTS_SNS_TOPIC_ARN"');
    expect(script).toContain('"value": ses_events_sns_topic_arn');
    expect(script).toContain('"SES_EVENTS_SNS_TOPIC_ARN"');
    expect(script).toContain(
      'write_app_task_definition "${base_task_definition}" "${app_image}" "${webhook_secret_arn}" "${tracking_secret_arn}" "${SES_EVENTS_SNS_TOPIC_ARN}" "${task_file}"',
    );
  });

  it("deploy script injects the SES events SNS topic ARN into the ingester task environment", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain(
      'write_ingester_task_definition \\\n    "${base_task_definition}" \\\n    "${ingester_image}"',
    );
    expect(script).toContain(
      '"${SES_EVENTS_SNS_TOPIC_ARN}" \\\n    "${task_file}"',
    );
    expect(script).toContain(
      'for name in ["AWS_REGION", "S3_BUCKET_NAME", "SES_EVENTS_SNS_TOPIC_ARN"]',
    );
    expect(script).toContain(
      'required_environment["SES_EVENTS_SNS_TOPIC_ARN"] = ses_events_sns_topic_arn',
    );
  });

  it("deploy script carries receiving storage config into the ingester task definition", () => {
    const script = readFileSync(join(root, "scripts", "deploy.sh"), "utf-8");
    expect(script).toContain("INGESTER_INBOUND_TOKEN_SECRET_ID");
    expect(script).toContain("ingester_inbound_token_secret_arn");
    expect(script).toContain('"name": "INGESTER_INBOUND_TOKEN"');
    expect(script).toContain(
      'for name in ["AWS_REGION", "S3_BUCKET_NAME", "SES_EVENTS_SNS_TOPIC_ARN"]',
    );
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

  it("docker-compose includes a dedicated ingester service with a healthcheck", () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf-8");
    expect(compose).toContain("ingester:");
    expect(compose).toContain("dockerfile: packages/ingester/Dockerfile");
    expect(compose).toContain("INGESTER_PORT:-3016");
    expect(compose).toContain("http://127.0.0.1:3016/health");
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

  it("ingester runbook captures the split deploy and operational steps", () => {
    const runbookPath = join(root, "docs", "ingester-deploy.md");
    expect(existsSync(runbookPath)).toBe(true);
    const runbook = readFileSync(runbookPath, "utf-8");
    expect(runbook).toContain("SES SNS should point at");
    expect(runbook).toContain("aws logs tail");
    expect(runbook).toContain("curl -i");
  });
});
