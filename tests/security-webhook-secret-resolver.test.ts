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
        signingSecretEnc: enc,
      }),
    ).toBe(plain);
  });

  it("uses encrypted column when present", () => {
    const plain = "whsec_realencryptedvalue";
    const enc = encryptWebhookSecret(plain);
    expect(
      resolveWebhookSigningSecret({
        signingSecretEnc: enc,
      }),
    ).toBe(plain);
  });

  it("returns empty string when enc is null", () => {
    expect(
      resolveWebhookSigningSecret({
        signingSecretEnc: null,
      }),
    ).toBe("");
  });

  it("returns empty string when enc has unrecognized format", () => {
    expect(
      resolveWebhookSigningSecret({
        signingSecretEnc: "not-a-v1-envelope",
      }),
    ).toBe("");
  });

  it("returns empty string when neither column is set", () => {
    expect(
      resolveWebhookSigningSecret({
        signingSecretEnc: null,
      }),
    ).toBe("");
  });
});
