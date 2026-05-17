import {
  MimeHeaderInjectionError,
  safeMimeBoundary,
  sanitizeHeaderName,
  sanitizeHeaderValue,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

describe("mime-sanitize", () => {
  it("rejects CRLF in subject", () => {
    expect(() =>
      sanitizeHeaderValue("Subject", "Hello\r\nBcc: evil@x.com"),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("rejects LF only", () => {
    expect(() =>
      sanitizeHeaderValue("From", "user@example.com\nBcc: x@y"),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("rejects NUL byte", () => {
    expect(() => sanitizeHeaderValue("To", "user@x.com\0extra")).toThrow(
      MimeHeaderInjectionError,
    );
  });

  it("passes normal value", () => {
    expect(sanitizeHeaderValue("Subject", "Hello world")).toBe("Hello world");
  });

  it("rejects invalid header name", () => {
    expect(() => sanitizeHeaderName("X-Bad Name")).toThrow(
      MimeHeaderInjectionError,
    );
  });

  it("accepts valid header name", () => {
    expect(sanitizeHeaderName("X-Custom-Header")).toBe("X-Custom-Header");
  });

  it("produces strong boundary with prefix", () => {
    const b1 = safeMimeBoundary();
    const b2 = safeMimeBoundary();
    expect(b1).not.toBe(b2);
    expect(b1.startsWith("----opensend-")).toBe(true);
    expect(b1.length).toBeGreaterThan(20);
  });
});
