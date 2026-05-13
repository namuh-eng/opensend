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
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "RATE_LIMIT_BACKEND",
  "REDIS_URL",
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
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some(
        (l) => l.data.event === "security.rate_limit.disabled_in_production",
      ),
    ).toBe(true);
  });

  it("does not warn about rate limit when REDIS_URL set", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.REDIS_URL = "redis://localhost:6379";
    const { logs, logger } = makeLogger();
    runStartupChecks(logger);
    expect(
      logs.some(
        (l) => l.data.event === "security.rate_limit.disabled_in_production",
      ),
    ).toBe(false);
  });

  it("warns on default postgres password in production", () => {
    vi.stubEnv("NODE_ENV", "production");
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
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.RATE_LIMIT_BACKEND = "redis";
    process.env.DATABASE_URL = "postgres://app:opensend@db/app";
    process.env.POSTGRES_PASSWORD_ENFORCE_CHANGE = "true";
    const { logger } = makeLogger();
    expect(() => runStartupChecks(logger)).toThrow();
  });
});
