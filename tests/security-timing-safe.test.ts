import { timingSafeStringEqual } from "@opensend/core";
import { describe, expect, it } from "vitest";

describe("timing-safe", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeStringEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeStringEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(timingSafeStringEqual(undefined, "x")).toBe(false);
    expect(timingSafeStringEqual("x", null as unknown as string)).toBe(false);
    expect(timingSafeStringEqual(123 as unknown as string, "123")).toBe(false);
  });

  it("rejects inputs over 4 KB", () => {
    const big = "a".repeat(5000);
    expect(timingSafeStringEqual(big, big)).toBe(false);
  });

  it("returns false for empty vs nonempty", () => {
    expect(timingSafeStringEqual("", "x")).toBe(false);
  });

  it("returns true for both empty", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });
});
