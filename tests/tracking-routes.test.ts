import { createEmailTrackingToken } from "@opensend/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindTrackingContext = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());

vi.mock("@opensend/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@opensend/core")>();

  return {
    ...actual,
    trackingRouteService: {
      ...actual.trackingRouteService,
      findTrackingContext: mockFindTrackingContext,
    },
  };
});

vi.mock("@/lib/events", () => ({
  queueEvent: mockQueueEvent,
}));

function trackingToken(kind: "open" | "click", targetUrl?: string) {
  return createEmailTrackingToken({
    kind,
    userId: "user-1",
    emailId: "email-1",
    domainId: "domain-1",
    recipient: "person@example.com",
    targetUrl,
  });
}

describe("tracking routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindTrackingContext.mockResolvedValue({
      email: { id: "email-1", userId: "user-1" },
      domain: {
        id: "domain-1",
        userId: "user-1",
        trackClicks: true,
        trackOpens: true,
      },
    });
    mockQueueEvent.mockResolvedValue({ eventId: "event-1", deliveryIds: [] });
  });

  it("records click events and redirects only to the signed target URL", async () => {
    const { GET } = await import("../src/app/api/track/click/[token]/route");
    const token = trackingToken(
      "click",
      "https://destination.example.com/welcome?utm=1",
    );

    const response = await GET(
      new Request("https://track.example.com/api/track/click/token", {
        headers: {
          "user-agent": "vitest-agent",
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        },
      }),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://destination.example.com/welcome?utm=1",
    );
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "email.clicked",
      userId: "user-1",
      emailId: "email-1",
      payload: {
        email_id: "email-1",
        domain_id: "domain-1",
        recipient: "person@example.com",
        url: "https://destination.example.com/welcome?utm=1",
        user_agent: "vitest-agent",
        ip: "203.0.113.10",
      },
    });
  });

  it("rejects forged click tokens without using a redirect query parameter", async () => {
    const { GET } = await import("../src/app/api/track/click/[token]/route");
    const token = `${trackingToken("click", "https://safe.example.com")}forged`;

    const response = await GET(
      new Request(
        "https://track.example.com/api/track/click/token?url=https://evil.example.com",
      ),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(mockQueueEvent).not.toHaveBeenCalled();
  });

  it("records open events and returns a no-store transparent image", async () => {
    const { GET } = await import("../src/app/api/track/open/[token]/route");
    const token = trackingToken("open");

    const response = await GET(
      new Request("https://track.example.com/api/track/open/token", {
        headers: { "user-agent": "pixel-agent" },
      }),
      { params: Promise.resolve({ token }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "email.opened",
      userId: "user-1",
      emailId: "email-1",
      payload: {
        email_id: "email-1",
        domain_id: "domain-1",
        recipient: "person@example.com",
        user_agent: "pixel-agent",
        ip: null,
      },
    });
  });

  it("does not create events when the domain toggle is disabled", async () => {
    mockFindTrackingContext.mockResolvedValue(null);
    const { GET } = await import("../src/app/api/track/click/[token]/route");

    const response = await GET(
      new Request("https://track.example.com/api/track/click/token"),
      {
        params: Promise.resolve({
          token: trackingToken("click", "https://destination.example.com"),
        }),
      },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(mockQueueEvent).not.toHaveBeenCalled();
  });

  it("does not create events when token tenant context is missing", async () => {
    mockFindTrackingContext.mockResolvedValue(null);
    const { GET } = await import("../src/app/api/track/open/[token]/route");

    const response = await GET(
      new Request("https://track.example.com/api/track/open/token"),
      { params: Promise.resolve({ token: trackingToken("open") }) },
    );

    expect(response.status).toBe(404);
    expect(mockQueueEvent).not.toHaveBeenCalled();
  });
});
