import { escapeCsvValue } from "@/lib/dashboard-export-types";
import { describe, expect, it } from "vitest";

describe("escapeCsvValue / formula injection", () => {
  it("prefixes '=' with apostrophe and quotes value", () => {
    // = triggers prefix; resulting `'=cmd|...` contains no special CSV chars so no quoting.
    expect(escapeCsvValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
  });

  it("prefixes '+' with apostrophe", () => {
    expect(escapeCsvValue("+1234")).toBe("'+1234");
  });

  it("prefixes '-' with apostrophe", () => {
    expect(escapeCsvValue("-2+3")).toBe("'-2+3");
  });

  it("prefixes '@' with apostrophe (comma triggers CSV wrap)", () => {
    expect(escapeCsvValue("@SUM(1,2)")).toBe('"\'@SUM(1,2)"');
  });

  it("prefixes '@' with apostrophe (no CSV wrap when no special chars)", () => {
    expect(escapeCsvValue("@cmd")).toBe("'@cmd");
  });

  it("prefixes leading TAB with apostrophe", () => {
    // Leading TAB is sanitized; result has no comma/CR/LF/dquote, so no wrapping.
    expect(escapeCsvValue("\t=evil")).toBe("'\t=evil");
  });

  it("prefixes leading CR with apostrophe and CSV-wraps", () => {
    // CR also triggers CSV quote wrapping.
    expect(escapeCsvValue("\rfoo")).toBe('"\'\rfoo"');
  });

  it("does not modify benign strings", () => {
    expect(escapeCsvValue("hello@example.com")).toBe("hello@example.com");
    expect(escapeCsvValue("user-name")).toBe("user-name");
    expect(escapeCsvValue("plain text")).toBe("plain text");
  });

  it("handles null/undefined as empty string", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("handles numbers and booleans", () => {
    expect(escapeCsvValue(42)).toBe("42");
    expect(escapeCsvValue(true)).toBe("true");
  });

  it("CSV-wraps values containing comma even when not a formula", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
  });
});
