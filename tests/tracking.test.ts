import {
  applyEmailTracking,
  createEmailTrackingToken,
  getEmailAddressDomain,
  getEmailTrackingBaseUrl,
  verifyEmailTrackingToken,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

function tokenFor(kind: "open" | "click", targetUrl?: string) {
  return createEmailTrackingToken({
    kind,
    userId: "user-1",
    emailId: "email-1",
    domainId: "domain-1",
    recipient: "person@example.com",
    targetUrl,
  });
}

describe("email tracking helpers", () => {
  it("creates tenant-scoped opaque signed tokens and rejects tampering", () => {
    const token = tokenFor("click", "https://example.com/path?a=1");

    expect(token).not.toContain("https://example.com");
    expect(verifyEmailTrackingToken(token)).toMatchObject({
      kind: "click",
      userId: "user-1",
      emailId: "email-1",
      domainId: "domain-1",
      recipient: "person@example.com",
      targetUrl: "https://example.com/path?a=1",
    });
    expect(verifyEmailTrackingToken(`${token}tampered`)).toBeNull();
  });

  it("rewrites accepted HTTP links while preserving unsubscribe and non-web links", () => {
    const html = `<html><body>
      <a href="https://example.com/welcome?x=1&amp;y=2">Welcome</a>
      <a href='http://example.net/next'>Next</a>
      <a href="mailto:support@example.com">Mail</a>
      <a href="https://app.opensend.dev/unsubscribe/contact-1?token=u">Unsubscribe</a>
      <a data-role="list-unsubscribe" href="https://example.com/list">List unsubscribe</a>
    </body></html>`;

    const result = applyEmailTracking({
      html,
      clickTracking: true,
      openTracking: false,
      trackingBaseUrl: "https://track.example.com",
      createClickToken: (targetUrl) => tokenFor("click", targetUrl),
      createOpenToken: () => tokenFor("open"),
    });

    expect(result.rewroteLinks).toBe(2);
    expect(result.insertedOpenPixel).toBe(false);
    expect(result.html.match(/\/api\/track\/click\//g)).toHaveLength(2);
    expect(result.html).toContain("mailto:support@example.com");
    expect(result.html).toContain("/unsubscribe/contact-1?token=u");
    expect(result.html).toContain('data-role="list-unsubscribe"');
  });

  it("inserts exactly one 1x1 open pixel before body close", () => {
    const result = applyEmailTracking({
      html: "<html><body><p>Hello</p></body></html>",
      clickTracking: false,
      openTracking: true,
      trackingBaseUrl: "https://track.example.com/",
      createClickToken: (targetUrl) => tokenFor("click", targetUrl),
      createOpenToken: () => tokenFor("open"),
    });

    expect(result.rewroteLinks).toBe(0);
    expect(result.insertedOpenPixel).toBe(true);
    expect(result.html.match(/data-opensend-open-tracking/g)).toHaveLength(1);
    expect(result.html).toContain('width="1" height="1"');
    expect(result.html).toContain("/api/track/open/");
    expect(result.html.indexOf("data-opensend-open-tracking")).toBeLessThan(
      result.html.indexOf("</body>"),
    );

    const secondPass = applyEmailTracking({
      html: result.html,
      clickTracking: false,
      openTracking: true,
      trackingBaseUrl: "https://track.example.com",
      createClickToken: (targetUrl) => tokenFor("click", targetUrl),
      createOpenToken: () => tokenFor("open"),
    });
    expect(secondPass.html.match(/data-opensend-open-tracking/g)).toHaveLength(
      1,
    );
    expect(secondPass.insertedOpenPixel).toBe(false);
  });

  it("preserves HTML exactly when both toggles are disabled", () => {
    const html = '<p><a href="https://example.com">No tracking</a></p>';
    const result = applyEmailTracking({
      html,
      clickTracking: false,
      openTracking: false,
      trackingBaseUrl: "https://track.example.com",
      createClickToken: (targetUrl) => tokenFor("click", targetUrl),
      createOpenToken: () => tokenFor("open"),
    });

    expect(result).toEqual({
      html,
      rewroteLinks: 0,
      insertedOpenPixel: false,
    });
  });

  it("derives configured tracking subdomains and fallback app origins", () => {
    expect(
      getEmailTrackingBaseUrl({ trackingSubdomain: "track.example.com" }),
    ).toBe("https://track.example.com");
    expect(
      getEmailTrackingBaseUrl({
        trackingSubdomain: "http://localhost:3015/",
      }),
    ).toBe("http://localhost:3015");
    expect(
      getEmailTrackingBaseUrl({
        trackingSubdomain: "https://track.example.com/path?ignored=1",
      }),
    ).toBe("https://track.example.com");
    expect(
      getEmailTrackingBaseUrl({ fallbackBaseUrl: "https://app.example.com/" }),
    ).toBe("https://app.example.com");
    expect(getEmailAddressDomain("sender@example.com")).toBe("example.com");
    expect(getEmailAddressDomain("Sender <sender@example.com>")).toBe(
      "example.com",
    );
  });
});
