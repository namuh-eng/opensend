import { validateApiKeyRaw } from "@opensend/core";

export interface RelayAuthResult {
  userId: string;
  apiKeyId: string;
  permission: string;
  domain: string | null;
}

/**
 * Authenticate an SMTP AUTH LOGIN / PLAIN attempt.
 *
 * AUTH model:
 *   - Username: anything (conventionally "apikey" or the key itself)
 *   - Password: an OpenSend API key, e.g. os_live_...
 *
 * Only the password field is used for authentication. This matches the
 * ergonomics of other API-key-over-SMTP services where the username is
 * a placeholder. Both AUTH PLAIN (user/pass) and AUTH LOGIN (base64 steps)
 * are handled by smtp-server; the callback below receives the already-decoded
 * username and password strings.
 */
export async function authenticateSmtpSession(
  username: string | null | undefined,
  password: string | null | undefined,
): Promise<RelayAuthResult | null> {
  // Ignore username — the password IS the API key.
  // smtp-server delivers decoded plaintext strings.
  void username;

  return validateApiKeyRaw(password);
}
