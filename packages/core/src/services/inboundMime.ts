import { createHash } from "node:crypto";

export type InboundMimeAttachment = {
  id: string;
  filename: string;
  contentType: string;
  contentId?: string;
  size: number;
  content: Buffer;
};

export type ParsedInboundMime = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  recipients: string[];
  subject: string;
  html: string | null;
  text: string | null;
  messageId: string | null;
  date: Date | null;
  headers: Record<string, string>;
  attachments: InboundMimeAttachment[];
  size: number;
  contentHash: string;
};

export type InboundMimeParseErrorCode = "malformed_mime" | "oversized_message";

export class InboundMimeParseError extends Error {
  constructor(
    readonly code: InboundMimeParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InboundMimeParseError";
  }
}

type HeaderEntry = {
  name: string;
  value: string;
};

type ParsedHeaders = {
  entries: HeaderEntry[];
  map: Map<string, string[]>;
};

type MimeEntity = {
  headers: ParsedHeaders;
  body: string;
};

const DEFAULT_MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitEntity(raw: string): MimeEntity {
  const normalized = normalizeLineEndings(raw);
  const separator = normalized.search(/\n\n/);
  if (separator < 0) {
    throw new InboundMimeParseError(
      "malformed_mime",
      "MIME payload is missing a header/body separator",
    );
  }

  return {
    headers: parseHeaders(normalized.slice(0, separator)),
    body: normalized.slice(separator + 2),
  };
}

function parseHeaders(rawHeaders: string): ParsedHeaders {
  const unfolded: string[] = [];
  for (const line of rawHeaders.split("\n")) {
    if (/^[\t ]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] =
        `${unfolded[unfolded.length - 1]} ${line.trim()}`;
    } else if (line.trim()) {
      unfolded.push(line);
    }
  }

  const entries: HeaderEntry[] = [];
  const map = new Map<string, string[]>();
  for (const line of unfolded) {
    const index = line.indexOf(":");
    if (index <= 0) {
      throw new InboundMimeParseError(
        "malformed_mime",
        `Malformed MIME header: ${line.slice(0, 40)}`,
      );
    }
    const name = line.slice(0, index).trim();
    const value = decodeHeaderValue(line.slice(index + 1).trim());
    const key = name.toLowerCase();
    entries.push({ name, value });
    map.set(key, [...(map.get(key) ?? []), value]);
  }

  return { entries, map };
}

function getHeader(headers: ParsedHeaders, name: string): string | null {
  return headers.map.get(name.toLowerCase())?.join(", ") ?? null;
}

function headersToObject(headers: ParsedHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, values] of headers.map) {
    result[name] = values.join(", ");
  }
  return result;
}

function decodeHeaderValue(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g,
    (_match, charsetValue: string, encodingValue: string, encoded: string) => {
      const charset = charsetValue.toLowerCase();
      if (charset !== "utf-8" && charset !== "us-ascii") return encoded;
      if (encodingValue.toLowerCase() === "b") {
        return Buffer.from(encoded, "base64").toString("utf8");
      }
      const qp = encoded.replace(/_/g, " ");
      return decodeQuotedPrintable(qp).toString("utf8");
    },
  );
}

function parseHeaderParameters(value: string | null): {
  value: string;
  params: Record<string, string>;
} {
  if (!value) return { value: "", params: {} };
  const parts = value.split(";").map((part) => part.trim());
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const raw = part.slice(index + 1).trim();
    params[part.slice(0, index).trim().toLowerCase()] = decodeHeaderValue(
      raw.replace(/^"|"$/g, ""),
    );
  }
  return { value: parts[0]?.toLowerCase() ?? "", params };
}

function extractAddresses(value: string | null): string[] {
  if (!value) return [];
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((address) => address.toLowerCase()))];
}

function decodeQuotedPrintable(value: string): Buffer {
  const normalized = value.replace(/=\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    if (
      normalized[i] === "=" &&
      /^[0-9a-fA-F]{2}$/.test(normalized.slice(i + 1, i + 3))
    ) {
      bytes.push(Number.parseInt(normalized.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(normalized.charCodeAt(i));
    }
  }
  return Buffer.from(bytes);
}

function decodeBody(body: string, transferEncoding: string | null): Buffer {
  const encoding = transferEncoding?.toLowerCase().trim();
  if (encoding === "base64") {
    return Buffer.from(body.replace(/\s/g, ""), "base64");
  }
  if (encoding === "quoted-printable") {
    return decodeQuotedPrintable(body);
  }
  return Buffer.from(body.replace(/\n$/, ""), "utf8");
}

function splitMultipart(body: string, boundary: string): string[] {
  const marker = `--${boundary}`;
  const closing = `--${boundary}--`;
  const parts: string[] = [];
  let current: string[] | null = null;

  for (const line of normalizeLineEndings(body).split("\n")) {
    if (line === marker) {
      if (current) parts.push(current.join("\n"));
      current = [];
      continue;
    }
    if (line === closing) {
      if (current) parts.push(current.join("\n"));
      current = null;
      break;
    }
    if (current) current.push(line);
  }

  if (parts.length === 0) {
    throw new InboundMimeParseError(
      "malformed_mime",
      "Multipart MIME payload does not contain boundary parts",
    );
  }

  return parts;
}

function makeAttachmentId(
  filename: string,
  contentType: string,
  content: Buffer,
): string {
  return `att_${createHash("sha256")
    .update(filename)
    .update(contentType)
    .update(content)
    .digest("hex")
    .slice(0, 24)}`;
}

function collectParts(
  entity: MimeEntity,
  output: {
    html: string[];
    text: string[];
    attachments: InboundMimeAttachment[];
  },
): void {
  const contentType = parseHeaderParameters(
    getHeader(entity.headers, "content-type"),
  );
  const disposition = parseHeaderParameters(
    getHeader(entity.headers, "content-disposition"),
  );
  const transferEncoding = getHeader(
    entity.headers,
    "content-transfer-encoding",
  );
  const filename =
    disposition.params.filename ??
    contentType.params.name ??
    disposition.params["filename*"] ??
    contentType.params["name*"];

  if (contentType.value.startsWith("multipart/")) {
    const boundary = contentType.params.boundary;
    if (!boundary) {
      throw new InboundMimeParseError(
        "malformed_mime",
        "Multipart MIME payload is missing boundary",
      );
    }
    for (const part of splitMultipart(entity.body, boundary)) {
      collectParts(splitEntity(part), output);
    }
    return;
  }

  const content = decodeBody(entity.body, transferEncoding);
  const normalizedContentType = contentType.value || "text/plain";
  const isAttachment =
    Boolean(filename) || disposition.value.toLowerCase() === "attachment";

  if (!isAttachment && normalizedContentType === "text/plain") {
    output.text.push(content.toString("utf8"));
    return;
  }

  if (!isAttachment && normalizedContentType === "text/html") {
    output.html.push(content.toString("utf8"));
    return;
  }

  const safeFilename = filename?.trim() || "attachment";
  output.attachments.push({
    id: makeAttachmentId(safeFilename, normalizedContentType, content),
    filename: safeFilename,
    contentType: normalizedContentType,
    contentId: getHeader(entity.headers, "content-id")?.replace(/^<|>$/g, ""),
    size: content.length,
    content,
  });
}

export function parseInboundMime(
  rawInput: string | Buffer,
  options: { maxBytes?: number } = {},
): ParsedInboundMime {
  const raw =
    typeof rawInput === "string" ? Buffer.from(rawInput, "utf8") : rawInput;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
  if (raw.length > maxBytes) {
    throw new InboundMimeParseError(
      "oversized_message",
      `MIME payload exceeds ${maxBytes} bytes`,
    );
  }

  const root = splitEntity(raw.toString("utf8"));
  const from = extractAddresses(getHeader(root.headers, "from"))[0] ?? "";
  const to = extractAddresses(getHeader(root.headers, "to"));
  const cc = extractAddresses(getHeader(root.headers, "cc"));
  const bcc = extractAddresses(getHeader(root.headers, "bcc"));
  const recipients = [...new Set([...to, ...cc, ...bcc])];
  if (!from || recipients.length === 0) {
    throw new InboundMimeParseError(
      "malformed_mime",
      "MIME payload must include From and at least one recipient",
    );
  }

  const output: {
    html: string[];
    text: string[];
    attachments: InboundMimeAttachment[];
  } = { html: [], text: [], attachments: [] };
  collectParts(root, output);

  const rawDate = getHeader(root.headers, "date");
  const parsedDate = rawDate ? new Date(rawDate) : null;

  return {
    from,
    to,
    cc,
    bcc,
    recipients,
    subject: getHeader(root.headers, "subject") ?? "",
    html: output.html.length > 0 ? output.html.join("\n") : null,
    text: output.text.length > 0 ? output.text.join("\n") : null,
    messageId:
      getHeader(root.headers, "message-id")?.replace(/^<|>$/g, "") ?? null,
    date:
      parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : null,
    headers: headersToObject(root.headers),
    attachments: output.attachments,
    size: raw.length,
    contentHash: createHash("sha256").update(raw).digest("hex"),
  };
}
