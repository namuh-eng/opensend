import {
  type EnvValidationIssue,
  OpenSendEnvValidationError,
  validateOpenSendEnv,
} from "@opensend/core/src/env";

type Logger = {
  warn: (data: Record<string, unknown>, msg: string) => void;
  error: (data: Record<string, unknown>, msg: string) => void;
};

const defaultLogger: Logger = {
  warn: (data, msg) =>
    console.warn(JSON.stringify({ level: "warn", msg, ...data })),
  error: (data, msg) =>
    console.error(JSON.stringify({ level: "error", msg, ...data })),
};

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function issuePayload(issues: readonly EnvValidationIssue[]) {
  return issues.map((issue) => ({
    key: issue.key,
    message: issue.message,
  }));
}

function validateRequiredEnv(logger: Logger): void {
  const result = validateOpenSendEnv(process.env, { service: "app" });

  if (result.warnings.length > 0) {
    logger.warn(
      {
        event: "security.startup.env_warning",
        issues: issuePayload(result.warnings),
      },
      "OpenSend app environment preflight found non-fatal configuration warnings",
    );
  }

  if (result.errors.length > 0) {
    logger.error(
      {
        event: "security.startup.env_invalid",
        issues: issuePayload(result.errors),
      },
      "OpenSend app environment preflight failed — refusing to boot",
    );
    throw new OpenSendEnvValidationError("app", result.errors);
  }
}

function getConfiguredAppReplicas(): number {
  const raw = process.env.OPENSEND_APP_REPLICAS?.trim();
  if (!raw) return 1;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function warnIfRateLimitDisabled(logger: Logger): void {
  const backend = (process.env.RATE_LIMIT_BACKEND ?? "").trim().toLowerCase();
  if (backend === "redis") return;

  const appReplicas = getConfiguredAppReplicas();
  const backendLabel = backend || "disabled";

  if (isProd()) {
    logger.warn(
      {
        event: "security.rate_limit.disabled_in_production",
        backend: backendLabel,
        appReplicas,
      },
      "Rate limiting backend is disabled in production — set RATE_LIMIT_BACKEND=redis and REDIS_URL to a shared Redis endpoint",
    );
    return;
  }

  if (appReplicas > 1) {
    logger.warn(
      {
        event: "security.rate_limit.disabled_in_multi_instance",
        backend: backendLabel,
        appReplicas,
      },
      "Multiple app replicas are configured without Redis-backed rate limiting — set RATE_LIMIT_BACKEND=redis and REDIS_URL to a shared Redis endpoint",
    );
  }
}

function requirePostgresPassword(logger: Logger): void {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  if (!isProd()) return;
  const weak = /:(opensend|postgres|password|changeme|admin)@/i;
  if (weak.test(url)) {
    if (process.env.POSTGRES_PASSWORD_ENFORCE_CHANGE === "true") {
      logger.error(
        { event: "security.startup.weak_db_password" },
        "DATABASE_URL uses a default/weak password and POSTGRES_PASSWORD_ENFORCE_CHANGE=true",
      );
      throw new Error("Default Postgres password is forbidden");
    }
    logger.warn(
      { event: "security.startup.weak_db_password" },
      "DATABASE_URL appears to use a default/weak password — rotate it or set POSTGRES_PASSWORD_ENFORCE_CHANGE=true to hard-fail",
    );
  }
}

export function runStartupChecks(logger: Logger = defaultLogger): void {
  validateRequiredEnv(logger);
  warnIfRateLimitDisabled(logger);
  requirePostgresPassword(logger);
}
