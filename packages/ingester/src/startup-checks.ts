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
      "error",
      { event: "security.startup.weak_job_token" },
      "INGESTER_JOB_TOKEN missing/too short — refusing to boot",
    );
    throw new Error("INGESTER_JOB_TOKEN missing/too short in production");
  }

  const inboundToken = process.env.INGESTER_INBOUND_TOKEN?.trim();
  if (isProd() && (!inboundToken || inboundToken.length < 32)) {
    logJson(
      "warn",
      { event: "security.startup.weak_inbound_token" },
      "INGESTER_INBOUND_TOKEN missing/too short — /events/inbound rejects requests until configured",
    );
  }
}
