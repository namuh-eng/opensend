import { readFileSync } from "node:fs";
import {
  createTelemetryContext,
  logTelemetry,
  recordTelemetryError,
} from "@opensend/core";
import {
  SMTPServer,
  type SMTPServerAuthentication,
  type SMTPServerDataStream,
  type SMTPServerSession,
} from "smtp-server";
import { type RelayAuthResult, authenticateSmtpSession } from "./auth";
import type { SmtpRelayConfig } from "./config";
import { SmtpRelayError, relayMessage } from "./relay";

/**
 * Extended session type — we store the authenticated user info on the
 * smtp-server session object so the DATA callback can access it without
 * re-authenticating.
 */
interface RelaySession extends SMTPServerSession {
  user?: string;
}

function loadTlsFiles(
  certPath: string | null,
  keyPath: string | null,
): { cert: Buffer; key: Buffer } | null {
  if (!certPath || !keyPath) return null;
  try {
    return {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[smtp-relay] Warning: could not load TLS certificate/key — STARTTLS will be disabled. ${msg}`,
    );
    return null;
  }
}

export function createSmtpRelayServer(config: SmtpRelayConfig): SMTPServer {
  const tlsFiles = loadTlsFiles(config.tlsCertPath, config.tlsKeyPath);

  // STARTTLS is advertised when TLS material is available; without it the
  // server still works in plain-text (useful for development / loopback).
  // `allowInsecureAuth: true` lets clients send AUTH before STARTTLS —
  // required for plain-text development mode.
  const server = new SMTPServer({
    secure: false,
    ...(tlsFiles ? { cert: tlsFiles.cert, key: tlsFiles.key } : {}),
    allowInsecureAuth: !tlsFiles, // only allow plaintext auth when no TLS
    authMethods: ["LOGIN", "PLAIN"],
    name: "opensend-smtp-relay",
    size: config.maxMessageSizeBytes,

    // ── AUTH callback ──────────────────────────────────────────────
    onAuth(
      auth: SMTPServerAuthentication,
      _session: SMTPServerSession,
      callback: (
        err: Error | null,
        response?: { user: string } | undefined,
      ) => void,
    ) {
      const relayTelemetry = createTelemetryContext({
        service: config.serviceName,
        operation: "smtp.auth",
      });
      const username = auth.username ?? null;
      const password = auth.password ?? null;

      authenticateSmtpSession(username, password)
        .then((result) => {
          if (!result) {
            logTelemetry("warn", "smtp_relay.auth_failed", relayTelemetry, {
              username: username ?? "(none)",
            });
            callback(new Error("Invalid credentials"));
            return;
          }
          logTelemetry("info", "smtp_relay.auth_success", relayTelemetry, {
            user_id: result.userId,
            api_key_id: result.apiKeyId,
          });
          // Encode auth context in the user field so onData can retrieve it
          callback(null, { user: JSON.stringify(result) });
        })
        .catch((error: unknown) => {
          recordTelemetryError(relayTelemetry, "smtp_relay.auth_error", error);
          callback(new Error("Authentication failed"));
        });
    },

    // ── DATA callback ──────────────────────────────────────────────
    onData(
      stream: SMTPServerDataStream,
      session: RelaySession,
      callback: (err?: Error | null) => void,
    ) {
      const relayTelemetry = createTelemetryContext({
        service: config.serviceName,
        operation: "smtp.data",
      });

      // Decode auth context stored during AUTH phase
      let relayAuth: RelayAuthResult | null = null;
      if (typeof session.user === "string") {
        try {
          relayAuth = JSON.parse(session.user) as RelayAuthResult;
        } catch {
          // fall through — auth check below will reject
        }
      }

      if (!relayAuth) {
        stream.resume(); // drain the stream to prevent smtp-server hanging
        callback(new Error("Authentication context missing"));
        return;
      }

      const authSnapshot = relayAuth;

      relayMessage(stream, authSnapshot)
        .then(({ id }) => {
          logTelemetry("info", "smtp_relay.accepted", relayTelemetry, {
            email_id: id,
            user_id: authSnapshot.userId,
          });
          callback(null);
        })
        .catch((error: unknown) => {
          if (error instanceof SmtpRelayError) {
            logTelemetry("warn", "smtp_relay.rejected", relayTelemetry, {
              reason: error.message,
              smtp_code: error.smtpCode,
              user_id: authSnapshot.userId,
            });
            // smtp-server reads err.responseCode for the SMTP status
            const smtpErr = Object.assign(new Error(error.message), {
              responseCode: error.smtpCode,
            });
            callback(smtpErr);
          } else {
            recordTelemetryError(
              relayTelemetry,
              "smtp_relay.data_error",
              error,
            );
            callback(new Error("Internal server error"));
          }
        });
    },
  });

  // Log server-level errors without crashing the process
  server.on("error", (error: Error) => {
    const relayTelemetry = createTelemetryContext({
      service: config.serviceName,
      operation: "smtp.server_error",
    });
    recordTelemetryError(relayTelemetry, "smtp_relay.server_error", error);
  });

  return server;
}
