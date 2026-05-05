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
    expect(script).toContain("aws ecs update-service");
    expect(script).toContain("--force-new-deployment");
    expect(script).toContain("aws ecs wait services-stable");
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
