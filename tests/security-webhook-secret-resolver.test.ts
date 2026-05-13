import {
  encryptWebhookSecret,
  resolveWebhookSigningSecret,
} from "@opensend/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveWebhookSigningSecret", () => {
  beforeEach(() => {
    vi.stubEnv(
      "WEBHOOK_SECRET_ENCRYPTION_KEY",
      "test-encryption-key-1234567890ab",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("decrypts signing_secret_enc when present", () => {
    const plain = "whsec_abcdefghijklmnopqrstuvwx";
    const enc = encryptWebhookSecret(plain);
    expect(
      resolveWebhookSigningSecret({
        signingSecret: null,
        signingSecretEnc: enc,
      }),
    ).toBe(plain);
  });

  it("prefers encrypted column over legacy plaintext", () => {
    const plain = "whsec_realencryptedvalue";
    const enc = encryptWebhookSecret(plain);
    expect(
      resolveWebhookSigningSecret({
        signingSecret: "whsec_oldplaintext",
        signingSecretEnc: enc,
      }),
    ).toBe(plain);
  });

  it("falls back to legacy plaintext when enc is null", () => {
    expect(
      resolveWebhookSigningSecret({
        signingSecret: "whsec_legacy123",
        signingSecretEnc: null,
      }),
    ).toBe("whsec_legacy123");
  });

  it("falls back to legacy plaintext when enc has unrecognized format", () => {
    expect(
      resolveWebhookSigningSecret({
        signingSecret: "whsec_legacy",
        signingSecretEnc: "not-a-v1-envelope",
      }),
    ).toBe("whsec_legacy");
  });

  it("returns empty string when neither column is set", () => {
    expect(
      resolveWebhookSigningSecret({
        signingSecret: null,
        signingSecretEnc: null,
      }),
    ).toBe("");
  });
});
