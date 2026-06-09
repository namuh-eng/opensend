/**
 * OpenSend SMTP Relay — entrypoint.
 *
 * Speaks standard SMTP on a configurable port. Applications send mail via
 * STARTTLS + AUTH LOGIN/PLAIN (password = OpenSend API key). The relay
 * validates the key, parses the MIME message, checks suppressions, creates a
 * DB row, and enqueues a send job — the same pipeline the REST API uses.
 *
 * Environment variables (see src/config.ts for full list):
 *   SMTP_RELAY_PORT             TCP port to listen on (default: 2587)
 *   SMTP_RELAY_HOST             Bind address (default: 0.0.0.0)
 *   SMTP_RELAY_TLS_CERT_PATH    Path to PEM certificate (enables STARTTLS)
 *   SMTP_RELAY_TLS_KEY_PATH     Path to PEM private key
 *   DATABASE_URL                Postgres connection string (required)
 */

import { loadConfig } from "./config";
import { createSmtpRelayServer } from "./server";

const config = loadConfig();
const server = createSmtpRelayServer(config);

function shutdown(signal: string): void {
  console.log(
    `[smtp-relay] Received ${signal}. Closing SMTP server gracefully...`,
  );
  server.close(() => {
    console.log("[smtp-relay] Server closed.");
    process.exit(0);
  });

  // Force-exit after 10 s if close takes too long
  setTimeout(() => {
    console.error("[smtp-relay] Graceful close timed out; forcing exit.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(config.port, config.host, () => {
  console.log(
    `[smtp-relay] OpenSend SMTP relay listening on ${config.host}:${config.port}`,
  );
  if (config.tlsCertPath) {
    console.log("[smtp-relay] STARTTLS enabled");
  } else {
    console.log(
      "[smtp-relay] STARTTLS disabled (set SMTP_RELAY_TLS_CERT_PATH and SMTP_RELAY_TLS_KEY_PATH to enable)",
    );
  }
});
