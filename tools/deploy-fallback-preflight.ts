#!/usr/bin/env bun
// ABOUTME: Safe preflight for the manual ECS deploy fallback path.
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
const region = env.AWS_REGION || "us-east-1";
const product = env.PRODUCT || "opensend";
const cluster = env.ECS_CLUSTER || "namuh";
const appRepo = `${product}-app`;
const ingesterRepo = `${product}-ingester`;
const appService = `${product}-app`;
const ingesterService = `${product}-ingester`;
const appContainerName = env.APP_CONTAINER_NAME || `${product}-app`;
const ingesterContainerName = env.ING_CONTAINER_NAME || `${product}-ingester`;
// Mirrors the production app boot requirements enforced by
// src/lib/startup-checks.ts via packages/core/src/env.ts.
// The preflight validates metadata names only; it never reads secret values.
const appStartupRequiredEnvironmentOrSecretNames = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "TRACKING_SECRET",
  "UNSUBSCRIBE_SECRET",
  "DKIM_ENCRYPTION_KEY",
];
// Mirrors the production ingester boot requirements enforced by
// packages/ingester/src/startup-checks.ts via packages/core/src/env.ts.
// The preflight validates metadata names only; it never reads secret values.
const ingesterStartupRequiredEnvironmentOrSecretNames = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "BETTER_AUTH_SECRET",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "INGESTER_JOB_TOKEN",
  "INGESTER_INBOUND_TOKEN",
  "TRACKING_SECRET",
  "UNSUBSCRIBE_SECRET",
  "DKIM_ENCRYPTION_KEY",
];
const requiredSecretRefs = [
  {
    label: "Webhook secret encryption key",
    idEnvName: "WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ID",
    arnEnvName: "WEBHOOK_SECRET_ENCRYPTION_KEY_SECRET_ARN",
    defaultId: `${product}/webhook/secret-encryption-key`,
  },
  {
    label: "Tracking secret",
    idEnvName: "TRACKING_SECRET_SECRET_ID",
    arnEnvName: "TRACKING_SECRET_SECRET_ARN",
    defaultId: `${product}/tracking-secret`,
  },
  {
    label: "Ingester job token",
    idEnvName: "INGESTER_JOB_TOKEN_SECRET_ID",
    arnEnvName: "INGESTER_JOB_TOKEN_SECRET_ARN",
    defaultId: `${product}/ingester-job-token`,
  },
  {
    label: "Ingester inbound token",
    idEnvName: "INGESTER_INBOUND_TOKEN_SECRET_ID",
    arnEnvName: "INGESTER_INBOUND_TOKEN_SECRET_ARN",
    defaultId: `${product}/ingester-inbound-token`,
  },
];

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

function runWithInput(
  command: string,
  args: string[],
  input: string,
): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...env, AWS_REGION: region },
    input,
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

function ecsServicesActiveCheck(serviceNames: string[]): CheckResult {
  const label = "ECS services";
  const result = run("aws", [
    "ecs",
    "describe-services",
    "--cluster",
    cluster,
    "--services",
    ...serviceNames,
    "--query",
    "services[].{serviceName:serviceName,status:status}",
    "--output",
    "json",
    "--region",
    region,
  ]);
  if (result.status !== 0) {
    return { label, ok: false, detail: summarizeFailure(result) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return {
      label,
      ok: false,
      detail: "describe-services did not return JSON service status metadata",
    };
  }

  const services = Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  const serviceStatuses = new Map<string, string>();
  for (const service of services) {
    if (typeof service.serviceName !== "string") {
      continue;
    }

    serviceStatuses.set(
      service.serviceName,
      typeof service.status === "string" && service.status.length > 0
        ? service.status
        : "UNKNOWN",
    );
  }

  const missing = serviceNames.filter(
    (serviceName) => !serviceStatuses.has(serviceName),
  );
  if (missing.length > 0) {
    return {
      label,
      ok: false,
      detail: `missing expected services: ${missing.join(", ")}`,
    };
  }

  const inactive = serviceNames
    .map((serviceName) => ({
      serviceName,
      status: serviceStatuses.get(serviceName) ?? "UNKNOWN",
    }))
    .filter((service) => service.status !== "ACTIVE");
  if (inactive.length > 0) {
    return {
      label,
      ok: false,
      detail: `services must be ACTIVE before fallback deploy: ${inactive
        .map((service) => `${service.serviceName} status ${service.status}`)
        .join(", ")}`,
    };
  }

  return {
    label,
    ok: true,
    detail: `found ACTIVE services: ${serviceNames.join(", ")}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function ecsTaskDefinitionMetadataCheck(
  serviceName: string,
  expectedContainerName: string,
  requiredContainerSecretNames: string[] = [],
  requiredContainerEnvironmentOrSecretNames: string[] = [],
): CheckResult {
  const serviceResult = run("aws", [
    "ecs",
    "describe-services",
    "--cluster",
    cluster,
    "--services",
    serviceName,
    "--query",
    "{serviceName:services[0].serviceName,taskDefinition:services[0].taskDefinition}",
    "--output",
    "json",
    "--region",
    region,
  ]);
  const label = `ECS task definition metadata: ${serviceName}`;
  if (serviceResult.status !== 0) {
    return { label, ok: false, detail: summarizeFailure(serviceResult) };
  }

  const serviceMetadata = parseJsonObject(serviceResult.stdout);
  const taskDefinition =
    typeof serviceMetadata?.taskDefinition === "string"
      ? serviceMetadata.taskDefinition
      : "";
  if (!taskDefinition || taskDefinition === "None") {
    return {
      label,
      ok: false,
      detail: `${serviceName} did not return a current task definition`,
    };
  }

  const taskDefinitionResult = run("aws", [
    "ecs",
    "describe-task-definition",
    "--task-definition",
    taskDefinition,
    "--query",
    "{family:taskDefinition.family,containers:taskDefinition.containerDefinitions[].{name:name,secrets:secrets[].name,environment:environment[].name}}",
    "--output",
    "json",
    "--region",
    region,
  ]);
  if (taskDefinitionResult.status !== 0) {
    return {
      label,
      ok: false,
      detail: `${taskDefinition}: ${summarizeFailure(taskDefinitionResult)}`,
    };
  }

  const taskMetadata = parseJsonObject(taskDefinitionResult.stdout);
  const family =
    typeof taskMetadata?.family === "string" ? taskMetadata.family : "";
  const containerMetadata = Array.isArray(taskMetadata?.containers)
    ? taskMetadata.containers.filter(isRecord)
    : [];
  const containers = containerMetadata
    .map((container) =>
      typeof container.name === "string" ? container.name : "",
    )
    .filter((containerName) => containerName.length > 0);

  if (!family) {
    return {
      label,
      ok: false,
      detail: `${taskDefinition} did not return taskDefinition.family`,
    };
  }

  if (!containers.includes(expectedContainerName)) {
    return {
      label,
      ok: false,
      detail: `${taskDefinition} missing expected container ${expectedContainerName}; found ${containers.join(", ") || "none"}`,
    };
  }

  const expectedContainer = containerMetadata.find(
    (container) => container.name === expectedContainerName,
  );
  const secretNames = new Set(
    Array.isArray(expectedContainer?.secrets)
      ? expectedContainer.secrets.filter(
          (secretName): secretName is string =>
            typeof secretName === "string" && secretName.length > 0,
        )
      : [],
  );
  const environmentNames = new Set(
    Array.isArray(expectedContainer?.environment)
      ? expectedContainer.environment.filter(
          (environmentName): environmentName is string =>
            typeof environmentName === "string" && environmentName.length > 0,
        )
      : [],
  );
  const missingSecretNames = requiredContainerSecretNames.filter(
    (secretName) => !secretNames.has(secretName),
  );
  if (missingSecretNames.length > 0) {
    return {
      label,
      ok: false,
      detail: `${taskDefinition} container ${expectedContainerName} missing required secret metadata: ${missingSecretNames.join(", ")}`,
    };
  }

  const missingEnvironmentOrSecretNames =
    requiredContainerEnvironmentOrSecretNames.filter(
      (name) => !environmentNames.has(name) && !secretNames.has(name),
    );
  if (missingEnvironmentOrSecretNames.length > 0) {
    return {
      label,
      ok: false,
      detail: `${taskDefinition} container ${expectedContainerName} missing required environment or secret metadata: ${missingEnvironmentOrSecretNames.join(", ")}`,
    };
  }

  const secretDetail =
    requiredContainerSecretNames.length > 0
      ? ` requiredSecrets=${requiredContainerSecretNames.join(",")}`
      : "";
  const environmentOrSecretDetail =
    requiredContainerEnvironmentOrSecretNames.length > 0
      ? ` requiredEnvironmentOrSecrets=${requiredContainerEnvironmentOrSecretNames.join(",")}`
      : "";

  return {
    label,
    ok: true,
    detail: `${taskDefinition} family=${family} container=${expectedContainerName}${secretDetail}${environmentOrSecretDetail}`,
  };
}

interface SecretRef {
  label: string;
  idEnvName: string;
  arnEnvName: string;
  defaultId: string;
}

function secretIdentifier(secretRef: SecretRef): string {
  return (
    env[secretRef.arnEnvName] || env[secretRef.idEnvName] || secretRef.defaultId
  );
}

function secretMetadataCheck(secretRef: SecretRef): CheckResult {
  const identifier = secretIdentifier(secretRef);
  const source = env[secretRef.arnEnvName]
    ? secretRef.arnEnvName
    : env[secretRef.idEnvName]
      ? secretRef.idEnvName
      : `${secretRef.idEnvName} default`;

  const result = run("aws", [
    "secretsmanager",
    "describe-secret",
    "--secret-id",
    identifier,
    "--query",
    "{Name:Name,ARN:ARN}",
    "--output",
    "json",
    "--region",
    region,
  ]);
  if (result.status !== 0) {
    return {
      label: `Secrets Manager metadata: ${secretRef.label}`,
      ok: false,
      detail: `${source}: ${summarizeFailure(result)}`,
    };
  }

  return {
    label: `Secrets Manager metadata: ${secretRef.label}`,
    ok: true,
    detail: `${source} is resolvable`,
  };
}

function callerIdentity(): { check: CheckResult; account?: string } {
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
      check: {
        label: "AWS caller identity",
        ok: false,
        detail: summarizeFailure(result),
      },
    };
  }

  const account = result.stdout.trim();
  if (env.AWS_ACCOUNT_ID && env.AWS_ACCOUNT_ID !== account) {
    return {
      check: {
        label: "AWS caller identity",
        ok: false,
        detail: `authenticated to account ${account}, expected AWS_ACCOUNT_ID=${env.AWS_ACCOUNT_ID}`,
      },
      account,
    };
  }

  return {
    check: {
      label: "AWS caller identity",
      ok: true,
      detail: env.AWS_ACCOUNT_ID
        ? `account ${account} matches AWS_ACCOUNT_ID`
        : `account ${account}`,
    },
    account,
  };
}

function dockerEcrLoginCheck(account: string): CheckResult {
  const registry = `${account}.dkr.ecr.${region}.amazonaws.com`;
  const passwordResult = run("aws", [
    "ecr",
    "get-login-password",
    "--region",
    region,
  ]);
  if (passwordResult.status !== 0) {
    return {
      label: "Docker ECR login",
      ok: false,
      detail: summarizeFailure(passwordResult),
    };
  }

  const loginResult = runWithInput(
    "docker",
    ["login", "--username", "AWS", "--password-stdin", registry],
    passwordResult.stdout,
  );
  if (loginResult.status !== 0) {
    return {
      label: "Docker ECR login",
      ok: false,
      detail: summarizeFailure(loginResult),
    };
  }

  return {
    label: "Docker ECR login",
    ok: true,
    detail: `authenticated Docker to ${registry}`,
  };
}

function main(): void {
  const identity = callerIdentity();
  const checks: CheckResult[] = [
    commandCheck("Bun", "bun", ["--version"], (stdout) => stdout),
    commandCheck("Docker CLI", "docker", ["--version"], (stdout) => stdout),
    commandCheck(
      "Docker buildx",
      "docker",
      ["buildx", "version"],
      (stdout) => stdout,
    ),
    commandCheck("Python 3", "python3", ["--version"], (stdout) => stdout),
    awsGlobalCheck("AWS CLI", ["--version"], (stdout) => stdout),
    identity.check,
    identity.check.ok && identity.account
      ? dockerEcrLoginCheck(identity.account)
      : {
          label: "Docker ECR login",
          ok: false,
          detail: "skipped because AWS caller identity failed",
        },
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
    ecsServicesActiveCheck([appService, ingesterService]),
    ecsTaskDefinitionMetadataCheck(
      appService,
      appContainerName,
      [],
      appStartupRequiredEnvironmentOrSecretNames,
    ),
    ecsTaskDefinitionMetadataCheck(
      ingesterService,
      ingesterContainerName,
      ["DATABASE_URL", "BETTER_AUTH_SECRET"],
      ingesterStartupRequiredEnvironmentOrSecretNames,
    ),
    ...requiredSecretRefs.map((secretRef) => secretMetadataCheck(secretRef)),
  ];

  console.log("OpenSend deploy fallback preflight (no push/deploy)");
  console.log(`AWS_REGION=${region}`);
  console.log(`ECS_CLUSTER=${cluster}`);
  console.log(`PRODUCT=${product}`);
  console.log(`ECR repositories=${appRepo}, ${ingesterRepo}`);
  console.log(`ECS services=${appService}, ${ingesterService}`);
  console.log(`ECS containers=${appContainerName}, ${ingesterContainerName}`);
  console.log(
    `App startup required environment/secret metadata=${appStartupRequiredEnvironmentOrSecretNames.join(
      ", ",
    )} on the app container`,
  );
  console.log(
    "Scheduler base task required secret metadata=DATABASE_URL, BETTER_AUTH_SECRET on the ingester container",
  );
  console.log(
    `Ingester startup required environment/secret metadata=${ingesterStartupRequiredEnvironmentOrSecretNames.join(
      ", ",
    )} on the ingester container`,
  );
  console.log(
    `Required secret metadata=${requiredSecretRefs
      .map((secretRef) => secretRef.idEnvName)
      .join(", ")}`,
  );
  console.log(
    "Docker ECR login uses aws ecr get-login-password with docker --password-stdin; the password is not printed.",
  );
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
