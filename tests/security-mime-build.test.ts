import { buildMimeMessage } from "@/lib/ses";
import { MimeHeaderInjectionError } from "@opensend/core";
import { describe, expect, it } from "vitest";

function baseInput(
  overrides: Partial<Parameters<typeof buildMimeMessage>[0]> = {},
) {
  return {
    from: "sender@example.com",
    to: ["rcpt@example.com"],
    subject: "Hello",
    text: "hi",
    attachments: [
      {
        filename: "doc.txt",
        content: "aGVsbG8=",
      },
    ],
    ...overrides,
  };
}

describe("buildMimeMessage / header injection", () => {
  it("rejects CRLF in subject", () => {
    expect(() =>
      buildMimeMessage(baseInput({ subject: "Hi\r\nBcc: leak@evil.com" })),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("rejects LF in From", () => {
    expect(() =>
      buildMimeMessage(baseInput({ from: "a@b.com\nBcc: x@y.com" })),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("rejects newline in To list", () => {
    expect(() =>
      buildMimeMessage(baseInput({ to: ["a@b.com\nBcc: leak@x"] })),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("rejects newline in custom header", () => {
    expect(() =>
      buildMimeMessage(
        baseInput({ headers: { "X-Bad": "value\r\nX-Injected: 1" } }),
      ),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("rejects invalid header name (space)", () => {
    expect(() =>
      buildMimeMessage(baseInput({ headers: { "X Bad": "val" } })),
    ).toThrow(MimeHeaderInjectionError);
  });

  it("sanitizes attachment filename quotes", () => {
    const msg = buildMimeMessage(
      baseInput({
        attachments: [
          {
            filename: 'evil";X-Injected: 1',
            content: "aGVsbG8=",
          },
        ],
      }),
    );
    // Injected text must remain inside the quoted filename param, never as its own header line
    expect(msg).not.toMatch(/^X-Injected:/m);
    expect(msg).toMatch(/filename="evil_;X-Injected: 1"/);
  });

  it("uses random boundary (not Math.random Date.now)", () => {
    const a = buildMimeMessage(baseInput());
    const b = buildMimeMessage(baseInput());
    const boundaryA = a.match(/boundary="([^"]+)"/)?.[1];
    const boundaryB = b.match(/boundary="([^"]+)"/)?.[1];
    expect(boundaryA).toBeDefined();
    expect(boundaryB).toBeDefined();
    expect(boundaryA).not.toBe(boundaryB);
    expect((boundaryA ?? "").length).toBeGreaterThan(24);
  });
});
