import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIngesterStartupChecks } from "../packages/ingester/src/startup-checks";

const ENV_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "INGESTER_JOB_TOKEN",
  "INGESTER_INBOUND_TOKEN",
  "TRACKING_SECRET",
  "UNSUBSCRIBE_SECRET",
  "DKIM_ENCRYPTION_KEY",
];

function setProductionRequiredEnv(): void {
  process.env.DATABASE_URL = "postgres://app:strong-password@db/app";
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "https://mail.example.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://mail.example.com";
  process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
  process.env.INGESTER_JOB_TOKEN = "j".repeat(32);
  process.env.INGESTER_INBOUND_TOKEN = "i".repeat(32);
  process.env.TRACKING_SECRET = "t".repeat(32);
  process.env.UNSUBSCRIBE_SECRET = "u".repeat(32);
  process.env.DKIM_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
}

describe("ingester startup checks", () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const key of ENV_KEYS) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
    vi.restoreAllMocks();
  });

  it("throws in production when the job token is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    setProductionRequiredEnv();
    process.env.INGESTER_JOB_TOKEN = undefined;

    expect(() => runIngesterStartupChecks()).toThrow("INGESTER_JOB_TOKEN");
  });

  it("throws in production when the inbound token is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    setProductionRequiredEnv();
    process.env.INGESTER_INBOUND_TOKEN = undefined;

    expect(() => runIngesterStartupChecks()).toThrow("INGESTER_INBOUND_TOKEN");
  });

  it("throws in production when BETTER_AUTH_SECRET is missing or too short", () => {
    vi.stubEnv("NODE_ENV", "production");
    setProductionRequiredEnv();
    process.env.BETTER_AUTH_SECRET = undefined;

    expect(() => runIngesterStartupChecks()).toThrow("BETTER_AUTH_SECRET");
  });

  it("allows the local BETTER_AUTH_SECRET placeholder only for localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    setProductionRequiredEnv();
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";
    process.env.BETTER_AUTH_URL = "http://localhost:3015";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3015";

    expect(() => runIngesterStartupChecks()).not.toThrow();
  });

  it("throws when the local BETTER_AUTH_SECRET placeholder is used outside localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    setProductionRequiredEnv();
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";

    expect(() => runIngesterStartupChecks()).toThrow("BETTER_AUTH_SECRET");
  });

  it("throws with all missing production keys instead of first-missing only", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => runIngesterStartupChecks()).toThrow(
      /DATABASE_URL[\s\S]*BETTER_AUTH_URL[\s\S]*INGESTER_JOB_TOKEN/,
    );
  });
});
