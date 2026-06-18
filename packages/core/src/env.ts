import { randomBytes } from "node:crypto";

export type OpenSendService = "app" | "ingester" | "scheduler";
export type EnvIssueSeverity = "error" | "warning";

export type EnvValidationIssue = {
  key: string;
  message: string;
  severity: EnvIssueSeverity;
};

export type EnvValidationResult = {
  service: OpenSendService;
  production: boolean;
  issues: EnvValidationIssue[];
  errors: EnvValidationIssue[];
  warnings: EnvValidationIssue[];
  ok: boolean;
};

type EnvMap = Record<string, string | undefined>;

const LOCAL_BETTER_AUTH_SECRET =
  "local-dev-better-auth-secret-replace-before-production";
const LOCAL_INGESTER_JOB_TOKEN =
  "local-dev-ingester-job-token-replace-before-production";
const LOCAL_WEBHOOK_SECRET_ENCRYPTION_KEY =
  "local-dev-webhook-secret-replace-before-production";
const LOCAL_TRACKING_SECRET =
  "local-dev-tracking-secret-replace-before-production";
const LOCAL_UNSUBSCRIBE_SECRET =
  "local-dev-unsubscribe-secret-replace-before-production";
const LOCAL_INGESTER_INBOUND_TOKEN =
  "local-dev-ingester-inbound-token-replace-before-production";
const LOCAL_INTEGRATION_SECRET_ENCRYPTION_KEY =
  "local-dev-integration-secret-replace-before-production";
const LOCAL_CRON_AUTH_TOKEN =
  "local-dev-cron-auth-token-replace-before-production";
// Base64 for 32 zero bytes. Valid shape for localhost examples, never for production.
const LOCAL_DKIM_ENCRYPTION_KEY =
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export const LOCAL_SECRET_PLACEHOLDERS: Readonly<Record<string, string>> = {
  BETTER_AUTH_SECRET: LOCAL_BETTER_AUTH_SECRET,
  INGESTER_JOB_TOKEN: LOCAL_INGESTER_JOB_TOKEN,
  WEBHOOK_SECRET_ENCRYPTION_KEY: LOCAL_WEBHOOK_SECRET_ENCRYPTION_KEY,
  TRACKING_SECRET: LOCAL_TRACKING_SECRET,
  UNSUBSCRIBE_SECRET: LOCAL_UNSUBSCRIBE_SECRET,
  INGESTER_INBOUND_TOKEN: LOCAL_INGESTER_INBOUND_TOKEN,
  INTEGRATION_SECRET_ENCRYPTION_KEY: LOCAL_INTEGRATION_SECRET_ENCRYPTION_KEY,
  CRON_AUTH_TOKEN: LOCAL_CRON_AUTH_TOKEN,
  DKIM_ENCRYPTION_KEY: LOCAL_DKIM_ENCRYPTION_KEY,
};

export const GENERATED_SECRET_KEYS = [
  "POSTGRES_PASSWORD",
  "BETTER_AUTH_SECRET",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "INTEGRATION_SECRET_ENCRYPTION_KEY",
  "INGESTER_JOB_TOKEN",
  "INGESTER_INBOUND_TOKEN",
  "TRACKING_SECRET",
  "UNSUBSCRIBE_SECRET",
  "DKIM_ENCRYPTION_KEY",
  "CRON_AUTH_TOKEN",
] as const;

export type GeneratedSecretKey = (typeof GENERATED_SECRET_KEYS)[number];

export const EXTERNAL_ENV_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
  "S3_BUCKET_NAME",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

export type ExternalEnvKey = (typeof EXTERNAL_ENV_KEYS)[number];

function value(env: EnvMap, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const hostname = new URL(raw).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function allConfiguredAppUrlsAreLocal(env: EnvMap): boolean {
  const urls = [
    value(env, "BETTER_AUTH_URL"),
    value(env, "NEXT_PUBLIC_APP_URL"),
  ].filter((item): item is string => Boolean(item));
  return urls.length > 0 && urls.every(isLocalUrl);
}

function decodedBase64Bytes(raw: string): number | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0) {
    return null;
  }
  try {
    return Buffer.from(raw, "base64").byteLength;
  } catch {
    return null;
  }
}

function addIssue(
  issues: EnvValidationIssue[],
  severity: EnvIssueSeverity,
  key: string,
  message: string,
): void {
  issues.push({ key, message, severity });
}

function requirePresent(
  env: EnvMap,
  issues: EnvValidationIssue[],
  key: string,
  message = "is required",
): void {
  if (!value(env, key)) addIssue(issues, "error", key, message);
}

function requireUrl(
  env: EnvMap,
  issues: EnvValidationIssue[],
  key: string,
): void {
  const raw = value(env, key);
  if (!raw) {
    addIssue(issues, "error", key, "is required");
    return;
  }
  if (!isUrl(raw)) addIssue(issues, "error", key, "must be an http(s) URL");
}

function requireMinLength(
  env: EnvMap,
  issues: EnvValidationIssue[],
  key: string,
  minLength: number,
): void {
  const raw = value(env, key);
  if (!raw) {
    addIssue(
      issues,
      "error",
      key,
      `is required and must be at least ${minLength} characters`,
    );
    return;
  }
  if (raw.length < minLength) {
    addIssue(issues, "error", key, `must be at least ${minLength} characters`);
  }
}

function warnMinLength(
  env: EnvMap,
  issues: EnvValidationIssue[],
  key: string,
  minLength: number,
  message: string,
): void {
  const raw = value(env, key);
  if (!raw || raw.length < minLength) addIssue(issues, "warning", key, message);
}

function requireDkimKey(env: EnvMap, issues: EnvValidationIssue[]): void {
  const raw = value(env, "DKIM_ENCRYPTION_KEY");
  if (!raw) {
    addIssue(
      issues,
      "error",
      "DKIM_ENCRYPTION_KEY",
      "is required and must be base64 for exactly 32 bytes",
    );
    return;
  }
  const decodedLength = decodedBase64Bytes(raw);
  if (decodedLength !== 32) {
    addIssue(
      issues,
      "error",
      "DKIM_ENCRYPTION_KEY",
      "must be base64 for exactly 32 bytes",
    );
  }
}

function requireTrustedOrigins(
  env: EnvMap,
  issues: EnvValidationIssue[],
): void {
  const raw = value(env, "BETTER_AUTH_TRUSTED_ORIGINS");
  if (!raw) {
    addIssue(
      issues,
      "error",
      "BETTER_AUTH_TRUSTED_ORIGINS",
      "is required in production",
    );
    return;
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    addIssue(
      issues,
      "error",
      "BETTER_AUTH_TRUSTED_ORIGINS",
      "must include at least one origin",
    );
    return;
  }
  const invalid = origins.filter((origin) => !isUrl(origin));
  if (invalid.length > 0) {
    addIssue(
      issues,
      "error",
      "BETTER_AUTH_TRUSTED_ORIGINS",
      "must contain only comma-separated http(s) origins",
    );
  }
}

function forbidLocalPlaceholdersOutsideLocalhost(
  env: EnvMap,
  issues: EnvValidationIssue[],
): void {
  if (allConfiguredAppUrlsAreLocal(env)) return;
  for (const [key, placeholder] of Object.entries(LOCAL_SECRET_PLACEHOLDERS)) {
    if (value(env, key) === placeholder) {
      addIssue(
        issues,
        "error",
        key,
        "uses the checked-in localhost placeholder; generate a real value for shared, staging, or production deploys",
      );
    }
  }
}

function validateProductionApp(
  env: EnvMap,
  issues: EnvValidationIssue[],
): void {
  requirePresent(env, issues, "DATABASE_URL");
  requireUrl(env, issues, "BETTER_AUTH_URL");
  requireUrl(env, issues, "NEXT_PUBLIC_APP_URL");
  requireMinLength(env, issues, "BETTER_AUTH_SECRET", 32);
  requireTrustedOrigins(env, issues);
  requireMinLength(env, issues, "WEBHOOK_SECRET_ENCRYPTION_KEY", 16);
  requireMinLength(env, issues, "TRACKING_SECRET", 16);
  requireMinLength(env, issues, "UNSUBSCRIBE_SECRET", 16);
  requireDkimKey(env, issues);
}

function validateProductionIngester(
  env: EnvMap,
  issues: EnvValidationIssue[],
): void {
  requirePresent(env, issues, "DATABASE_URL");
  requireUrl(env, issues, "BETTER_AUTH_URL");
  requireUrl(env, issues, "NEXT_PUBLIC_APP_URL");
  requireMinLength(env, issues, "BETTER_AUTH_SECRET", 32);
  requireMinLength(env, issues, "WEBHOOK_SECRET_ENCRYPTION_KEY", 16);
  requireMinLength(env, issues, "INGESTER_JOB_TOKEN", 32);
  requireMinLength(env, issues, "INGESTER_INBOUND_TOKEN", 32);
  requireMinLength(env, issues, "TRACKING_SECRET", 16);
  requireMinLength(env, issues, "UNSUBSCRIBE_SECRET", 16);
  requireDkimKey(env, issues);
}

function validateProductionScheduler(
  env: EnvMap,
  issues: EnvValidationIssue[],
): void {
  requirePresent(env, issues, "DATABASE_URL");
  requireUrl(env, issues, "INGESTER_URL");
  requireMinLength(env, issues, "INGESTER_JOB_TOKEN", 32);
}

function validateDevelopment(
  env: EnvMap,
  service: OpenSendService,
  issues: EnvValidationIssue[],
): void {
  if (service === "app") {
    warnMinLength(
      env,
      issues,
      "WEBHOOK_SECRET_ENCRYPTION_KEY",
      16,
      "webhook secret encryption is disabled until configured",
    );
    const integrationKey =
      value(env, "INTEGRATION_SECRET_ENCRYPTION_KEY") ??
      value(env, "WEBHOOK_SECRET_ENCRYPTION_KEY");
    if (!integrationKey || integrationKey.length < 16) {
      addIssue(
        issues,
        "warning",
        "INTEGRATION_SECRET_ENCRYPTION_KEY",
        "integration connectors cannot store credentials until configured",
      );
    }
  }

  if (service === "ingester") {
    warnMinLength(
      env,
      issues,
      "WEBHOOK_SECRET_ENCRYPTION_KEY",
      16,
      "webhook secret encryption is disabled until configured",
    );
  }
}

export function validateOpenSendEnv(
  env: EnvMap,
  options: { service: OpenSendService; production?: boolean },
): EnvValidationResult {
  const production =
    options.production ?? value(env, "NODE_ENV") === "production";
  const issues: EnvValidationIssue[] = [];

  if (production) {
    if (options.service === "app") validateProductionApp(env, issues);
    if (options.service === "ingester") validateProductionIngester(env, issues);
    if (options.service === "scheduler")
      validateProductionScheduler(env, issues);
    if (options.service !== "scheduler") {
      forbidLocalPlaceholdersOutsideLocalhost(env, issues);
    }
  } else {
    validateDevelopment(env, options.service, issues);
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return {
    service: options.service,
    production,
    issues,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

export function formatEnvIssues(issues: readonly EnvValidationIssue[]): string {
  return issues.map((issue) => `${issue.key}: ${issue.message}`).join("; ");
}

export class OpenSendEnvValidationError extends Error {
  readonly issues: EnvValidationIssue[];
  readonly service: OpenSendService;

  constructor(service: OpenSendService, issues: EnvValidationIssue[]) {
    super(
      `OpenSend ${service} environment preflight failed with ${issues.length} missing/invalid key${issues.length === 1 ? "" : "s"}: ${formatEnvIssues(issues)}`,
    );
    this.name = "OpenSendEnvValidationError";
    this.service = service;
    this.issues = issues;
  }
}

export function assertValidOpenSendEnv(
  env: EnvMap,
  options: { service: OpenSendService; production?: boolean },
): EnvValidationResult {
  const result = validateOpenSendEnv(env, options);
  if (result.errors.length > 0) {
    throw new OpenSendEnvValidationError(options.service, result.errors);
  }
  return result;
}

function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

function randomBase64(bytes = 32): string {
  return randomBytes(bytes).toString("base64");
}

export type GeneratedOpenSendEnvInput = {
  appUrl?: string;
  postgresPassword?: string;
  external?: Partial<Record<ExternalEnvKey, string>>;
};

export function createGeneratedOpenSendEnv(
  input: GeneratedOpenSendEnvInput = {},
): Record<string, string> {
  const appUrl = input.appUrl?.trim() || "http://localhost:3015";
  const postgresPassword = input.postgresPassword?.trim() || randomHex(24);
  const external = input.external ?? {};
  const awsRegion = external.AWS_REGION?.trim() || "us-east-1";

  return {
    DATABASE_URL: `postgresql://opensend:${encodeURIComponent(postgresPassword)}@localhost:5432/opensend`,
    POSTGRES_PASSWORD: postgresPassword,
    BETTER_AUTH_SECRET: randomHex(32),
    BETTER_AUTH_URL: appUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    BETTER_AUTH_TRUSTED_ORIGINS: appUrl,
    GOOGLE_CLIENT_ID: external.GOOGLE_CLIENT_ID?.trim() ?? "",
    GOOGLE_CLIENT_SECRET: external.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    AWS_ACCESS_KEY_ID: external.AWS_ACCESS_KEY_ID?.trim() ?? "",
    AWS_SECRET_ACCESS_KEY: external.AWS_SECRET_ACCESS_KEY?.trim() ?? "",
    AWS_REGION: awsRegion,
    S3_BUCKET_NAME: external.S3_BUCKET_NAME?.trim() ?? "",
    CLOUDFLARE_API_TOKEN: external.CLOUDFLARE_API_TOKEN?.trim() ?? "",
    CLOUDFLARE_ZONE_ID: external.CLOUDFLARE_ZONE_ID?.trim() ?? "",
    RATE_LIMIT_BACKEND: "disabled",
    REDIS_URL: "",
    BACKGROUND_JOBS_QUEUE_URL: "",
    BACKGROUND_JOBS_EVENT_BUS_NAME: "",
    BACKGROUND_JOBS_REQUIRE_QUEUE: "false",
    BACKGROUND_JOBS_DB_POLLING_FALLBACK: "true",
    BACKGROUND_WORKER_POLL: "true",
    INGESTER_HEALTH_URL: "http://localhost:3016/health",
    INGESTER_URL: "http://ingester:3016",
    INGESTER_JOB_TOKEN: randomHex(32),
    INGESTER_INBOUND_TOKEN: randomHex(32),
    INGESTER_SCHEDULER_INTERVAL_SECONDS: "60",
    TRACKING_SECRET: randomHex(32),
    UNSUBSCRIBE_SECRET: randomHex(32),
    WEBHOOK_SECRET_ENCRYPTION_KEY: randomHex(32),
    INTEGRATION_SECRET_ENCRYPTION_KEY: randomHex(32),
    DKIM_ENCRYPTION_KEY: randomBase64(32),
    DKIM_KEY_VERSION: "1",
    CRON_AUTH_TOKEN: randomHex(32),
    TRUSTED_PROXY_HOPS: "0",
  };
}

function line(key: string, value: string): string {
  return `${key}=${value}`;
}

export function renderOpenSendEnvFile(values: Record<string, string>): string {
  const sections: Array<[string, string[]]> = [
    ["Database", ["DATABASE_URL", "POSTGRES_PASSWORD"]],
    [
      "Auth and public URLs",
      [
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "NEXT_PUBLIC_APP_URL",
        "BETTER_AUTH_TRUSTED_ORIGINS",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
      ],
    ],
    [
      "AWS SES/S3 and DNS integrations",
      [
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_REGION",
        "S3_BUCKET_NAME",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ZONE_ID",
      ],
    ],
    [
      "Rate limiting, cache, and background jobs",
      [
        "RATE_LIMIT_BACKEND",
        "REDIS_URL",
        "BACKGROUND_JOBS_QUEUE_URL",
        "BACKGROUND_JOBS_EVENT_BUS_NAME",
        "BACKGROUND_JOBS_REQUIRE_QUEUE",
        "BACKGROUND_JOBS_DB_POLLING_FALLBACK",
        "BACKGROUND_WORKER_POLL",
        "INGESTER_HEALTH_URL",
        "INGESTER_URL",
      ],
    ],
    [
      "Ingester and scheduler",
      [
        "INGESTER_JOB_TOKEN",
        "INGESTER_INBOUND_TOKEN",
        "INGESTER_SCHEDULER_INTERVAL_SECONDS",
      ],
    ],
    [
      "Security secrets generated by bun run setup",
      [
        "TRACKING_SECRET",
        "UNSUBSCRIBE_SECRET",
        "WEBHOOK_SECRET_ENCRYPTION_KEY",
        "INTEGRATION_SECRET_ENCRYPTION_KEY",
        "DKIM_ENCRYPTION_KEY",
        "DKIM_KEY_VERSION",
        "CRON_AUTH_TOKEN",
        "TRUSTED_PROXY_HOPS",
      ],
    ],
  ];

  const output: string[] = [
    "# Generated by `bun run setup`.",
    "# Keep this file out of git. Production deploys should inject these values",
    "# from a secrets manager or platform secret store instead of baking them into images.",
  ];

  for (const [title, keys] of sections) {
    output.push("", `# ${title}`);
    for (const key of keys) output.push(line(key, values[key] ?? ""));
  }

  output.push("");
  return output.join("\n");
}
