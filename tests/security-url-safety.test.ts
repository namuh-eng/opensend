import {
  UnsafeOutboundUrlError,
  _resetUrlSafetyCacheForTests,
  assertSafeOutboundUrl,
  parseAndValidateUrlSync,
} from "@opensend/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("url-safety / parseAndValidateUrlSync", () => {
  beforeEach(() => {
    _resetUrlSafetyCacheForTests();
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = undefined;
  });

  it("rejects file: scheme", () => {
    expect(parseAndValidateUrlSync("file:///etc/passwd", "create").ok).toBe(
      false,
    );
  });

  it("rejects javascript:", () => {
    expect(parseAndValidateUrlSync("javascript:alert(1)", "create").ok).toBe(
      false,
    );
  });

  it("rejects credentials in URL", () => {
    expect(
      parseAndValidateUrlSync("https://user:pw@example.com/hook", "create").ok,
    ).toBe(false);
  });

  it("rejects 127.0.0.1 literal", () => {
    expect(parseAndValidateUrlSync("http://127.0.0.1/x", "create").ok).toBe(
      false,
    );
  });

  it("rejects 169.254.169.254 (AWS IMDS)", () => {
    expect(
      parseAndValidateUrlSync("http://169.254.169.254/", "create").ok,
    ).toBe(false);
  });

  it("rejects 10.0.0.5 (RFC1918)", () => {
    expect(parseAndValidateUrlSync("http://10.0.0.5/", "create").ok).toBe(
      false,
    );
  });

  it("rejects metadata.google.internal", () => {
    expect(
      parseAndValidateUrlSync("http://metadata.google.internal/", "create").ok,
    ).toBe(false);
  });

  it("rejects *.internal", () => {
    expect(parseAndValidateUrlSync("http://foo.internal/x", "create").ok).toBe(
      false,
    );
  });

  it("accepts plain public hostname (sync stage only)", () => {
    expect(
      parseAndValidateUrlSync("https://example.com/hook", "create").ok,
    ).toBe(true);
  });

  it("ALLOW_PRIVATE_WEBHOOK_URLS does not allow loopback at create", () => {
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = "true";
    expect(parseAndValidateUrlSync("http://127.0.0.1/x", "create").ok).toBe(
      false,
    );
  });

  it("ALLOW_PRIVATE_WEBHOOK_URLS permits 10.0.0.5 at create", () => {
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = "true";
    expect(parseAndValidateUrlSync("http://10.0.0.5/x", "create").ok).toBe(
      true,
    );
  });
});

describe("url-safety / assertSafeOutboundUrl (DNS-resolved)", () => {
  beforeEach(() => {
    _resetUrlSafetyCacheForTests();
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = undefined;
  });
  afterEach(() => {
    _resetUrlSafetyCacheForTests();
  });

  it("rejects when DNS resolves to private IP (rebind defense)", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    await expect(
      assertSafeOutboundUrl("https://evil.example.com/hook", {
        context: "dispatch",
        dnsLookup: lookup,
      }),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });

  it("rejects when one of multiple records is private", async () => {
    const lookup = vi.fn().mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      assertSafeOutboundUrl("https://multi.example.com/hook", {
        context: "dispatch",
        dnsLookup: lookup,
      }),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });

  it("accepts when DNS resolves to public IP", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(
      assertSafeOutboundUrl("https://example.com/hook", {
        context: "dispatch",
        dnsLookup: lookup,
      }),
    ).resolves.toBeUndefined();
  });

  it("caches verdict within TTL (single DNS lookup)", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await assertSafeOutboundUrl("https://cached.example.com/hook", {
      context: "dispatch",
      dnsLookup: lookup,
    });
    await assertSafeOutboundUrl("https://cached.example.com/hook", {
      context: "dispatch",
      dnsLookup: lookup,
    });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("dispatch never permits loopback even with ALLOW_PRIVATE_WEBHOOK_URLS", async () => {
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = "true";
    const lookup = vi
      .fn()
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      assertSafeOutboundUrl("http://lan.example.com/hook", {
        context: "dispatch",
        dnsLookup: lookup,
      }),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });
});
