import { InboundMimeParseError, parseInboundMime } from "@opensend/core";
import { describe, expect, it } from "vitest";

const multipartMime = `From: "Sender" <sender@example.com>
To: Support <support@example.com>
Cc: Team <team@example.com>
Subject: =?UTF-8?Q?Inbound_=E2=9C=93?=
Message-ID: <message-123@example.com>
Date: Wed, 27 May 2026 10:00:00 +0000
Content-Type: multipart/mixed; boundary="mixed-boundary"

--mixed-boundary
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable

Hello=2C plain body.
--mixed-boundary
Content-Type: text/html; charset=utf-8

<p>Hello, html body.</p>
--mixed-boundary
Content-Type: application/pdf; name="invoice.pdf"
Content-Disposition: attachment; filename="invoice.pdf"
Content-ID: <invoice-1>
Content-Transfer-Encoding: base64

UERGIGNvbnRlbnQ=
--mixed-boundary--
`;

describe("inbound MIME parser", () => {
  it("normalizes headers, recipients, body parts, and attachment metadata", () => {
    const parsed = parseInboundMime(multipartMime);

    expect(parsed.from).toBe("sender@example.com");
    expect(parsed.to).toEqual(["support@example.com"]);
    expect(parsed.cc).toEqual(["team@example.com"]);
    expect(parsed.recipients).toEqual([
      "support@example.com",
      "team@example.com",
    ]);
    expect(parsed.subject).toBe("Inbound ✓");
    expect(parsed.messageId).toBe("message-123@example.com");
    expect(parsed.date?.toISOString()).toBe("2026-05-27T10:00:00.000Z");
    expect(parsed.headers["message-id"]).toBe("<message-123@example.com>");
    expect(parsed.text).toBe("Hello, plain body.");
    expect(parsed.html).toBe("<p>Hello, html body.</p>");
    expect(parsed.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({
      filename: "invoice.pdf",
      contentType: "application/pdf",
      contentId: "invoice-1",
      size: Buffer.from("PDF content").length,
    });
    expect(parsed.attachments[0]?.content.toString("utf8")).toBe("PDF content");
  });

  it("parses single-part plain text messages", () => {
    const parsed = parseInboundMime(
      "From: sender@example.com\nTo: user@example.com\nSubject: Hi\nContent-Type: text/plain\n\nHello",
    );

    expect(parsed.subject).toBe("Hi");
    expect(parsed.text).toBe("Hello");
    expect(parsed.html).toBeNull();
    expect(parsed.attachments).toEqual([]);
  });

  it("raises malformed_mime for invalid headers and missing recipients", () => {
    expect(() => parseInboundMime("not a header\n\nbody")).toThrow(
      new InboundMimeParseError(
        "malformed_mime",
        "Malformed MIME header: not a header",
      ),
    );

    expect(() => parseInboundMime("From: sender@example.com\n\nbody")).toThrow(
      new InboundMimeParseError(
        "malformed_mime",
        "MIME payload must include From and at least one recipient",
      ),
    );
  });

  it("raises oversized_message before parsing", () => {
    expect(() =>
      parseInboundMime("From: a@b.test\nTo: c@d.test\n\nhello", {
        maxBytes: 8,
      }),
    ).toThrow(
      new InboundMimeParseError(
        "oversized_message",
        "MIME payload exceeds 8 bytes",
      ),
    );
  });
});
