function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

const LOCAL_BETTER_AUTH_SECRET =
  "local-dev-better-auth-secret-replace-before-production";

function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
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

function allConfiguredAppUrlsAreLocal(): boolean {
  const urls = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);
  return urls.length > 0 && urls.every(isLocalUrl);
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
  const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (isProd() && (!authSecret || authSecret.length < 32)) {
    logJson(
      "error",
      { event: "security.startup.weak_auth_secret" },
      "BETTER_AUTH_SECRET missing/too short — refusing to boot",
    );
    throw new Error("BETTER_AUTH_SECRET missing/too short in production");
  }
  if (
    isProd() &&
    authSecret === LOCAL_BETTER_AUTH_SECRET &&
    !allConfiguredAppUrlsAreLocal()
  ) {
    logJson(
      "error",
      { event: "security.startup.local_auth_secret_in_production" },
      "BETTER_AUTH_SECRET still uses the local .env.example placeholder for a non-local deployment",
    );
    throw new Error("Local BETTER_AUTH_SECRET placeholder is forbidden");
  }

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
