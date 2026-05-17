function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function logJson(
  level: "warn" | "error",
  data: Record<string, unknown>,
  msg: string,
): void {
  const line = JSON.stringify({ level, msg, ...data });
  if (level === "error") console.error(line);
  else console.warn(line);
}

export function runIngesterStartupChecks(): void {
  const key = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    if (isProd()) {
      logJson(
        "error",
        { event: "security.startup.missing_key" },
        "WEBHOOK_SECRET_ENCRYPTION_KEY missing/too short — refusing to boot",
      );
      throw new Error(
        "WEBHOOK_SECRET_ENCRYPTION_KEY missing/too short in production",
      );
    }
    logJson(
      "warn",
      { event: "security.startup.missing_key_dev" },
      "WEBHOOK_SECRET_ENCRYPTION_KEY missing — encryption disabled (non-production)",
    );
  }
  const jobToken = process.env.INGESTER_JOB_TOKEN?.trim();
  if (isProd() && (!jobToken || jobToken.length < 32)) {
    logJson(
      "warn",
      { event: "security.startup.weak_job_token" },
      "INGESTER_JOB_TOKEN missing or shorter than 32 chars in production",
    );
  }
}
