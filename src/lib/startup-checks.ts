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

function requireWebhookSecretKey(logger: Logger): void {
  const key = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    if (isProd()) {
      logger.error(
        { event: "security.startup.missing_key" },
        "WEBHOOK_SECRET_ENCRYPTION_KEY missing or too short (>=16 chars required) — refusing to boot",
      );
      throw new Error(
        "WEBHOOK_SECRET_ENCRYPTION_KEY missing/too short in production",
      );
    }
    logger.warn(
      { event: "security.startup.missing_key_dev" },
      "WEBHOOK_SECRET_ENCRYPTION_KEY missing or too short — webhook secret encryption disabled in non-production",
    );
  }
}

function warnIfRateLimitDisabled(logger: Logger): void {
  if (!isProd()) return;
  const backend = (process.env.RATE_LIMIT_BACKEND ?? "").toLowerCase();
  if (backend === "redis") return;
  if (backend === "" && process.env.REDIS_URL) return;
  logger.warn(
    {
      event: "security.rate_limit.disabled_in_production",
      backend: backend || "disabled",
    },
    "Rate limiting backend is disabled in production — set REDIS_URL or RATE_LIMIT_BACKEND=redis",
  );
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
  requireWebhookSecretKey(logger);
  warnIfRateLimitDisabled(logger);
  requirePostgresPassword(logger);
}
