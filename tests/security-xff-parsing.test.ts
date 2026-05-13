import { extractClientIp } from "@/middleware";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeRequest(headers: Record<string, string>): NextRequest {
  const url = "http://example.com/api/test";
  const request = new Request(url, { headers }) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as unknown as NextRequest;
}

describe("extractClientIp / X-Forwarded-For trust", () => {
  beforeEach(() => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("selects the right-most XFF hop when TRUSTED_PROXY_HOPS=0", () => {
    const req = makeRequest({
      "x-forwarded-for": "10.0.0.1, 10.0.0.2, 8.8.8.8",
    });
    expect(extractClientIp(req)).toBe("8.8.8.8");
  });

  it("ignores attacker-spoofed left-most hops", () => {
    // Attacker prepends "1.2.3.4" hoping the app trusts the left-most entry.
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4, 203.0.113.7, 198.51.100.10",
    });
    expect(extractClientIp(req)).toBe("198.51.100.10");
  });

  it("respects TRUSTED_PROXY_HOPS=1 (one trusted proxy in front)", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4, 203.0.113.7, 10.0.0.99",
    });
    expect(extractClientIp(req)).toBe("203.0.113.7");
  });

  it("respects TRUSTED_PROXY_HOPS=2", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4, 203.0.113.7, 10.0.0.99",
    });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });

  it("clamps when hops exceed list length", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "99");
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4, 203.0.113.7",
    });
    expect(extractClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when XFF is absent", () => {
    const req = makeRequest({ "x-real-ip": "9.9.9.9" });
    expect(extractClientIp(req)).toBe("9.9.9.9");
  });

  it("returns empty string when no proxy headers present", () => {
    const req = makeRequest({});
    expect(extractClientIp(req)).toBe("");
  });

  it("handles single-hop XFF", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.7" });
    expect(extractClientIp(req)).toBe("203.0.113.7");
  });

  it("trims whitespace around hops", () => {
    const req = makeRequest({
      "x-forwarded-for": "  1.2.3.4 ,  203.0.113.7  ",
    });
    expect(extractClientIp(req)).toBe("203.0.113.7");
  });

  it("treats invalid TRUSTED_PROXY_HOPS as 0", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "abc");
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4, 8.8.8.8",
    });
    expect(extractClientIp(req)).toBe("8.8.8.8");
  });
});
