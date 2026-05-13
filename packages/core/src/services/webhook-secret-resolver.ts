import {
  decryptWebhookSecret,
  isEncryptedWebhookSecret,
} from "../security/webhook-secret-crypto";

type WebhookSecretRow = {
  signingSecret: string | null;
  signingSecretEnc: string | null;
};

/**
 * Resolves the plaintext signing secret for a webhook row, preferring the
 * AES-256-GCM envelope (`signing_secret_enc`) and falling back to the legacy
 * plaintext column (`signing_secret`) while the rollout backfill is in flight.
 * Returns an empty string if neither is set (matches the historical dispatcher
 * fallback that signed with `""` rather than skipping delivery).
 */
export function resolveWebhookSigningSecret(row: WebhookSecretRow): string {
  if (row.signingSecretEnc && isEncryptedWebhookSecret(row.signingSecretEnc)) {
    return decryptWebhookSecret(row.signingSecretEnc);
  }
  return row.signingSecret ?? "";
}
