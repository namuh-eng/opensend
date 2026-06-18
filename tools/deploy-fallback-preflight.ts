#!/usr/bin/env bun
// ABOUTME: Non-mutating preflight for the manual ECS deploy fallback path.
// ABOUTME: Verifies local Docker/AWS reachability before running scripts/deploy.sh.

import { spawnSync } from "node:child_process";

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

const env = process.env;
const region = env.AWS_REGION || env.AWS_DEFAULT_REGION || "us-east-1";
const product = env.PRODUCT || "opensend";
const cluster = env.ECS_CLUSTER || "namuh";
const appRepo = env.APP_REPO || `${product}-app`;
const ingesterRepo = env.ING_REPO || `${product}-ingester`;
const appService = env.APP_SERVICE || `${product}-app`;
const ingesterService = env.ING_SERVICE || `${product}-ingester`;
const webhookSecretId =
  env.WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID ||
  `${product}/webhook/secret-encryption-key`;

function run(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...env, AWS_REGION: region },
  });

  return {
    status: result.status ?? (result.error ? 127 : 1),
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
  };
}

function summarizeFailure(result: CommandResult): string {
  return result.stderr || result.stdout || `exit ${result.status}`;
}

function commandCheck(
  label: string,
  command: string,
  args: string[],
  successDetail: (stdout: string) => string,
): CheckResult {
  const result = run(command, args);
  if (result.status !== 0) {
    return { label, ok: false, detail: summarizeFailure(result) };
  }

  return { label, ok: true, detail: successDetail(result.stdout) };
}

function awsCheck(
  label: string,
  args: string[],
  successDetail: (stdout: string) => string,
): CheckResult {
  return commandCheck(
    label,
    "aws",
    [...args, "--region", region],
    successDetail,
  );
}

function awsGlobalCheck(
  label: string,
  args: string[],
  successDetail: (stdout: string) => string,
): CheckResult {
  return commandCheck(label, "aws", args, successDetail);
}

function awsNameListCheck(
  label: string,
  args: string[],
  expectedNames: string[],
): CheckResult {
  const result = run("aws", [...args, "--region", region]);
  if (result.status !== 0) {
    return { label, ok: false, detail: summarizeFailure(result) };
  }

  const names = result.stdout.split(/\s+/).filter(Boolean);
  const missing = expectedNames.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    return {
      label,
      ok: false,
      detail: `missing expected names: ${missing.join(", ")}`,
    };
  }

  return { label, ok: true, detail: `found ${names.join(", ")}` };
}

function identityCheck(): CheckResult {
  const result = run("aws", [
    "sts",
    "get-caller-identity",
    "--query",
    "Account",
    "--output",
    "text",
    "--region",
    region,
  ]);
  if (result.status !== 0) {
    return {
      label: "AWS caller identity",
      ok: false,
      detail: summarizeFailure(result),
    };
  }

  const account = result.stdout.trim();
  if (env.AWS_ACCOUNT_ID && env.AWS_ACCOUNT_ID !== account) {
    return {
      label: "AWS caller identity",
      ok: false,
      detail: `authenticated to account ${account}, expected AWS_ACCOUNT_ID=${env.AWS_ACCOUNT_ID}`,
    };
  }

  return {
    label: "AWS caller identity",
    ok: true,
    detail: env.AWS_ACCOUNT_ID
      ? `account ${account} matches AWS_ACCOUNT_ID`
      : `account ${account}`,
  };
}

function main(): void {
  const checks: CheckResult[] = [
    commandCheck("Docker CLI", "docker", ["--version"], (stdout) => stdout),
    commandCheck(
      "Docker buildx",
      "docker",
      ["buildx", "version"],
      (stdout) => stdout,
    ),
    awsGlobalCheck("AWS CLI", ["--version"], (stdout) => stdout),
    identityCheck(),
    awsNameListCheck(
      "ECR repositories",
      [
        "ecr",
        "describe-repositories",
        "--repository-names",
        appRepo,
        ingesterRepo,
        "--query",
        "repositories[].repositoryName",
        "--output",
        "text",
      ],
      [appRepo, ingesterRepo],
    ),
    awsNameListCheck(
      "ECS services",
      [
        "ecs",
        "describe-services",
        "--cluster",
        cluster,
        "--services",
        appService,
        ingesterService,
        "--query",
        "services[].serviceName",
        "--output",
        "text",
      ],
      [appService, ingesterService],
    ),
    awsCheck(
      "Secrets Manager secret name",
      [
        "secretsmanager",
        "describe-secret",
        "--secret-id",
        webhookSecretId,
        "--query",
        "Name",
        "--output",
        "text",
      ],
      (stdout) => `found ${stdout}`,
    ),
  ];

  console.log("OpenSend deploy fallback preflight (non-mutating)");
  console.log(`AWS_REGION=${region}`);
  console.log(`ECS_CLUSTER=${cluster}`);
  console.log(`PRODUCT=${product}`);
  console.log(`APP_REPO=${appRepo}`);
  console.log(`ING_REPO=${ingesterRepo}`);
  console.log(`APP_SERVICE=${appService}`);
  console.log(`ING_SERVICE=${ingesterService}`);
  console.log(`WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID=${webhookSecretId}`);
  console.log("Secret values are not fetched or printed.\n");

  for (const check of checks) {
    const status = check.ok ? "PASS" : "FAIL";
    console.log(`[${status}] ${check.label}: ${check.detail}`);
  }

  if (checks.some((check) => !check.ok)) {
    console.error(
      "\nPreflight failed. Do not run the fallback deploy until every check passes.",
    );
    process.exit(1);
  }

  console.log(
    "\nPreflight passed. Fallback deploy command: bash scripts/deploy.sh all",
  );
}

main();
