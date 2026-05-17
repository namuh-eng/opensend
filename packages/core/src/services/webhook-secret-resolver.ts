import {
  decryptWebhookSecret,
  isEncryptedWebhookSecret,
} from "../security/webhook-secret-crypto";

type WebhookSecretRow = {
  signingSecretEnc: string | null;
};

/**
 * Resolves the plaintext signing secret for a webhook row from the
 * AES-256-GCM envelope (`signing_secret_enc`).
 * Returns an empty string if neither is set (matches the historical dispatcher
 * fallback that signed with `""` rather than skipping delivery).
 */
export function resolveWebhookSigningSecret(row: WebhookSecretRow): string {
  if (row.signingSecretEnc && isEncryptedWebhookSecret(row.signingSecretEnc)) {
    return decryptWebhookSecret(row.signingSecretEnc);
  }
  return "";
}
