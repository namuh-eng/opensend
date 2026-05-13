import {
  WebhookSecretCryptoError,
  decryptWebhookSecret,
  encryptWebhookSecret,
  isEncryptedWebhookSecret,
} from "@opensend/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const TEST_KEY = "test-master-key-min-16-chars-long-enough";

describe("webhook-secret-crypto", () => {
  const prev = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = TEST_KEY;
  });
  afterEach(() => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = prev;
  });

  it("round-trips a secret", () => {
    const ct = encryptWebhookSecret("whsec_supersecret123");
    expect(ct).toMatch(/^v1\./);
    expect(decryptWebhookSecret(ct)).toBe("whsec_supersecret123");
  });

  it("produces distinct ciphertexts each call (random IV)", () => {
    const a = encryptWebhookSecret("same");
    const b = encryptWebhookSecret("same");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", () => {
    const ct = encryptWebhookSecret("hello");
    const parts = ct.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.AAAAAAAAAAAAAAAAAAAAAA`;
    expect(() => decryptWebhookSecret(tampered)).toThrow();
  });

  it("rejects bad format", () => {
    expect(() => decryptWebhookSecret("not-encrypted")).toThrow(
      WebhookSecretCryptoError,
    );
  });

  it("throws when key missing", () => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = undefined;
    expect(() => encryptWebhookSecret("x")).toThrow(WebhookSecretCryptoError);
  });

  it("throws when key too short", () => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "short";
    expect(() => encryptWebhookSecret("x")).toThrow(WebhookSecretCryptoError);
  });

  it("isEncryptedWebhookSecret detects format", () => {
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = TEST_KEY;
    const ct = encryptWebhookSecret("x");
    expect(isEncryptedWebhookSecret(ct)).toBe(true);
    expect(isEncryptedWebhookSecret("plain")).toBe(false);
  });
});
