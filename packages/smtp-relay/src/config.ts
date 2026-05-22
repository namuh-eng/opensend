/**
 * Environment-driven configuration for the OpenSend SMTP relay.
 *
 * All values have safe defaults so the service can start without a full
 * production environment; only DATABASE_URL is strictly required at runtime.
 */

export interface SmtpRelayConfig {
  /** TCP port the SMTP server listens on. Default: 2587. */
  port: number;

  /** Host/interface the SMTP server binds to. Default: 0.0.0.0. */
  host: string;

  /**
   * If set, the path to a PEM-encoded TLS certificate file.
   * Required for STARTTLS support; when absent the server still accepts
   * connections but TLS upgrade is not advertised.
   */
  tlsCertPath: string | null;

  /** Path to the PEM-encoded private key matching tlsCertPath. */
  tlsKeyPath: string | null;

  /**
   * Maximum allowed message size in bytes. Default: 40 MB.
   * Matches the REST API attachment limit so the same payload succeeds
   * both ways.
   */
  maxMessageSizeBytes: number;

  /** Service name written to log lines. */
  serviceName: string;
}

const DEFAULT_PORT = 2587;
const DEFAULT_MAX_MESSAGE_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB

function parsePort(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return DEFAULT_PORT;
  return Math.floor(n);
}

function parseMaxSize(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_MESSAGE_SIZE_BYTES;
  return Math.floor(n);
}

export function loadConfig(): SmtpRelayConfig {
  return {
    port: parsePort(process.env.SMTP_RELAY_PORT),
    host: process.env.SMTP_RELAY_HOST ?? "0.0.0.0",
    tlsCertPath: process.env.SMTP_RELAY_TLS_CERT_PATH ?? null,
    tlsKeyPath: process.env.SMTP_RELAY_TLS_KEY_PATH ?? null,
    maxMessageSizeBytes: parseMaxSize(
      process.env.SMTP_RELAY_MAX_MESSAGE_SIZE_BYTES,
    ),
    serviceName: "smtp-relay",
  };
}
