import { createHash, timingSafeEqual } from "node:crypto";

const MAX_INPUT_BYTES = 4096;

/**
 * Constant-time string comparison.
 * - Returns false for non-string inputs.
 * - Inputs >4KB are rejected (returns false) to prevent CPU oracles.
 * - Normalizes lengths via SHA-256 so different-length inputs still compare in constant time.
 */
export function timingSafeStringEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.byteLength > MAX_INPUT_BYTES || bBuf.byteLength > MAX_INPUT_BYTES) {
    return false;
  }
  const aHash = createHash("sha256").update(aBuf).digest();
  const bHash = createHash("sha256").update(bBuf).digest();
  return timingSafeEqual(aHash, bHash) && aBuf.byteLength === bBuf.byteLength;
}
