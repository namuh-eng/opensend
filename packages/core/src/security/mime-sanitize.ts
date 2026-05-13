import { randomBytes } from "node:crypto";

export class MimeHeaderInjectionError extends Error {
  readonly code = "MIME_HEADER_INJECTION";
  constructor(field: string) {
    super(`MIME header injection detected in field: ${field}`);
    this.name = "MimeHeaderInjectionError";
  }
}

const CRLF_NUL = /[\r\n\0]/;
const HEADER_NAME_VALID = /^[!-9;-~]+$/; // visible ASCII minus ":" per RFC 5322

export function sanitizeHeaderName(name: string): string {
  if (!HEADER_NAME_VALID.test(name)) {
    throw new MimeHeaderInjectionError(`name:${name}`);
  }
  return name;
}

export function sanitizeHeaderValue(field: string, value: string): string {
  if (typeof value !== "string") {
    throw new MimeHeaderInjectionError(field);
  }
  if (CRLF_NUL.test(value)) {
    throw new MimeHeaderInjectionError(field);
  }
  return value;
}

export function sanitizeAddressList(field: string, raw: string): string {
  return sanitizeHeaderValue(field, raw);
}

/**
 * Cryptographically strong MIME boundary, RFC 2046-compliant token charset.
 */
export function safeMimeBoundary(prefix = "----opensend"): string {
  const rnd = randomBytes(18).toString("base64url");
  return `${prefix}-${rnd}`;
}
