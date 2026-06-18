import { runStartupChecks } from "@/lib/startup-checks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Captured = {
  level: "warn" | "error";
  data: Record<string, unknown>;
  msg: string;
};

function makeLogger(): {
  logs: Captured[];
  logger: {
    warn: (d: Record<string, unknown>, m: string) => void;
    error: (d: Record<string, unknown>, m: string) => void;
  };
} {
  const logs: Captured[] = [];
  return {
    logs,
    logger: {
      warn: (data, msg) => logs.push({ level: "warn", data, msg }),
      error: (data, msg) => logs.push({ level: "error", data, msg }),
    },
  };
}

const ENV_KEYS = [
  "NODE_ENV",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "RATE_LIMIT_BACKEND",
  "REDIS_URL",
  "OPENSEND_APP_REPLICAS",
  "DATABASE_URL",
  "POSTGRES_PASSWORD_ENFORCE_CHANGE",
];

describe("startup-checks", () => {
  const snapshot: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("throws in production when WEBHOOK_SECRET_ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).toThrow();
  });

  it("warns (does not throw) in dev when key missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { logs, logger } = makeLogger();
    expect(() => runStartupChecks(logger)).not.toThrow();
    expect(
      logs.some((l) => l.data.event === "security.startup.missing_key_dev"),
    ).toBe(true);
  });

  it("warns when rate limit disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some(
        (l) => l.data.event === "security.rate_limit.disabled_in_production",
      ),
    ).toBe(true);
  });

  it("warns in production when only REDIS_URL is set without redis backend", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.REDIS_URL = "redis://localhost:6379";
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some(
        (l) => l.data.event === "security.rate_limit.disabled_in_production",
      ),
    ).toBe(true);
  });

  it("warns for multiple app replicas outside production when redis backend is disabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.OPENSEND_APP_REPLICAS = "2";
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some(
        (l) =>
          l.data.event === "security.rate_limit.disabled_in_multi_instance" &&
          l.data.appReplicas === 2,
      ),
    ).toBe(true);
  });

  it("does not warn for multiple app replicas when redis backend is selected", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.OPENSEND_APP_REPLICAS = "2";
    process.env.RATE_LIMIT_BACKEND = "redis";
    process.env.REDIS_URL = "redis://localhost:6379";
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some((l) =>
        String(l.data.event ?? "").startsWith("security.rate_limit."),
      ),
    ).toBe(false);
  });

  it("treats malformed OPENSEND_APP_REPLICAS as a single local app", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.OPENSEND_APP_REPLICAS = "not-a-number";
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some((l) =>
        String(l.data.event ?? "").startsWith("security.rate_limit."),
      ),
    ).toBe(false);
  });

  it("warns on default postgres password in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    process.env.DATABASE_URL = "postgres://app:opensend@db/app";
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some((l) => l.data.event === "security.startup.weak_db_password"),
    ).toBe(true);
  });

  it("hard-fails on weak password when enforce flag set", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    process.env.DATABASE_URL = "postgres://app:opensend@db/app";
    process.env.POSTGRES_PASSWORD_ENFORCE_CHANGE = "true";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).toThrow();
  });

  it("throws in production when BETTER_AUTH_SECRET is missing or too short", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).toThrow(
      "BETTER_AUTH_SECRET missing/too short in production",
    );
  });

  it("allows the local BETTER_AUTH_SECRET placeholder only for localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";
    process.env.BETTER_AUTH_URL = "http://localhost:3015";
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).not.toThrow();
  });

  it("throws when the local BETTER_AUTH_SECRET placeholder is used outside localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";
    process.env.BETTER_AUTH_URL = "https://mail.example.com";
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).toThrow(
      "Local BETTER_AUTH_SECRET placeholder is forbidden",
    );
  });

  it("throws when any configured app URL is public with the local BETTER_AUTH_SECRET placeholder", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";
    process.env.BETTER_AUTH_URL = "http://localhost:3015";
    process.env.NEXT_PUBLIC_APP_URL = "https://mail.example.com";
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).toThrow(
      "Local BETTER_AUTH_SECRET placeholder is forbidden",
    );
  });
});
