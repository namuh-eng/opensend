import * as Sentry from "@sentry/node";

const dsn = process.env.INGESTER_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) {
        event.user.ip_address = undefined;
        if (event.user.email) event.user.email = "[redacted]";
      }
      if (event.request) {
        if (event.request.cookies) event.request.cookies = {};
        if (
          event.request.headers &&
          typeof event.request.headers === "object"
        ) {
          const headers = event.request.headers as Record<string, string>;
          for (const name of Object.keys(headers)) {
            if (
              [
                "authorization",
                "cookie",
                "set-cookie",
                "x-api-key",
                "x-auth-token",
                "x-csrf-token",
                "x-forwarded-for",
              ].includes(name.toLowerCase())
            ) {
              headers[name] = "[redacted]";
            }
          }
        }
      }
      return event;
    },
  });
}

export { Sentry };
