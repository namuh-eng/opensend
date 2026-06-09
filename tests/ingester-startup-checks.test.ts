import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIngesterStartupChecks } from "../packages/ingester/src/startup-checks";

const ENV_KEYS = [
  "NODE_ENV",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "WEBHOOK_SECRET_ENCRYPTION_KEY",
  "INGESTER_JOB_TOKEN",
  "INGESTER_INBOUND_TOKEN",
];

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
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);

    expect(() => runIngesterStartupChecks()).toThrow(
      "INGESTER_JOB_TOKEN missing/too short in production",
    );
  });

  it("warns but does not boot-fail when the optional inbound token is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET = "x".repeat(32);
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.INGESTER_JOB_TOKEN = "j".repeat(32);

    expect(() => runIngesterStartupChecks()).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("security.startup.weak_inbound_token"),
    );
  });

  it("throws in production when BETTER_AUTH_SECRET is missing or too short", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.INGESTER_JOB_TOKEN = "j".repeat(32);

    expect(() => runIngesterStartupChecks()).toThrow(
      "BETTER_AUTH_SECRET missing/too short in production",
    );
  });

  it("allows the local BETTER_AUTH_SECRET placeholder only for localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";
    process.env.BETTER_AUTH_URL = "http://localhost:3015";
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.INGESTER_JOB_TOKEN = "j".repeat(32);

    expect(() => runIngesterStartupChecks()).not.toThrow();
  });

  it("throws when the local BETTER_AUTH_SECRET placeholder is used outside localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_SECRET =
      "local-dev-better-auth-secret-replace-before-production";
    process.env.BETTER_AUTH_URL = "https://mail.example.com";
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "x".repeat(32);
    process.env.INGESTER_JOB_TOKEN = "j".repeat(32);

    expect(() => runIngesterStartupChecks()).toThrow(
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
    process.env.INGESTER_JOB_TOKEN = "j".repeat(32);

    expect(() => runIngesterStartupChecks()).toThrow(
      "Local BETTER_AUTH_SECRET placeholder is forbidden",
    );
  });
});
