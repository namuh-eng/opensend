import { scrubPiiFromEvent } from "@/lib/observability/sentry-scrub";
import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

function makeEvent(partial: Partial<ErrorEvent>): ErrorEvent {
  return {
    event_id: "e",
    timestamp: 0,
    ...partial,
  } as ErrorEvent;
}

describe("scrubPiiFromEvent", () => {
  it("redacts emails in messages", () => {
    const out = scrubPiiFromEvent(
      makeEvent({ message: "user alice@example.com failed to sign in" }),
    );
    expect(out?.message).toBe("user [redacted-email] failed to sign in");
  });

  it("redacts emails inside exception values", () => {
    const out = scrubPiiFromEvent(
      makeEvent({
        exception: {
          values: [
            { type: "Error", value: "could not find bob+spam@gmail.com" },
          ],
        },
      }),
    );
    expect(out?.exception?.values?.[0]?.value).toBe(
      "could not find [redacted-email]",
    );
  });

  it("drops user ip and email", () => {
    const out = scrubPiiFromEvent(
      makeEvent({
        user: { id: "u1", email: "carol@example.com", ip_address: "1.2.3.4" },
      }),
    );
    expect(out?.user?.ip_address).toBeUndefined();
    expect(out?.user?.email).toBe("[redacted]");
    expect(out?.user?.id).toBe("u1");
  });

  it("redacts sensitive headers", () => {
    const out = scrubPiiFromEvent(
      makeEvent({
        request: {
          headers: {
            authorization: "Bearer abc",
            "user-agent": "curl/8",
            cookie: "sess=xyz",
          },
        },
      }),
    );
    const headers = out?.request?.headers as Record<string, string>;
    expect(headers.authorization).toBe("[redacted]");
    expect(headers.cookie).toBe("[redacted]");
    expect(headers["user-agent"]).toBe("curl/8");
  });

  it("redacts secrets from request url query strings", () => {
    const out = scrubPiiFromEvent(
      makeEvent({
        request: { url: "https://example.com/cb?code=abc&state=xyz&safe=ok" },
      }),
    );
    const url = out?.request?.url as string;
    expect(url).toContain("code=%5Bredacted%5D");
    expect(url).toContain("state=%5Bredacted%5D");
    expect(url).toContain("safe=ok");
  });

  it("clears cookies", () => {
    const out = scrubPiiFromEvent(
      makeEvent({
        request: { cookies: { sess: "value" } },
      }),
    );
    expect(out?.request?.cookies).toEqual({});
  });
});
