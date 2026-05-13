import { escapeCsvValue } from "@opensend/core";
import { describe, expect, it } from "vitest";

describe("csv-escape", () => {
  it("prefixes = with quote", () => {
    expect(escapeCsvValue("=SUM(A1)")).toBe("'=SUM(A1)");
  });

  it("prefixes + with quote", () => {
    expect(escapeCsvValue("+1234")).toBe("'+1234");
  });

  it("prefixes - with quote", () => {
    expect(escapeCsvValue("-cmd")).toBe("'-cmd");
  });

  it("prefixes @ with quote", () => {
    expect(escapeCsvValue("@import")).toBe("'@import");
  });

  it("prefixes tab", () => {
    expect(escapeCsvValue("\tcmd")).toBe("'\tcmd");
  });

  it("prefixes CR (then wraps because CR triggers quoting)", () => {
    expect(escapeCsvValue("\rfoo")).toBe('"\'\rfoo"');
  });

  it("quotes values with commas", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
  });

  it("doubles inner quotes", () => {
    expect(escapeCsvValue('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("returns empty for null", () => {
    expect(escapeCsvValue(null)).toBe("");
  });

  it("returns empty for undefined", () => {
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("passes safe values through", () => {
    expect(escapeCsvValue("hello world")).toBe("hello world");
  });
});
