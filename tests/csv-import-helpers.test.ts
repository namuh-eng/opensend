import { SKIP_SENTINEL, buildMapping, parseCsvHeaders } from "@/lib/csv-import";
import Papa from "papaparse";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// buildMapping
// ---------------------------------------------------------------------------

describe("buildMapping", () => {
  it("returns mapping for valid assignments", () => {
    const result = buildMapping({
      Email: "email",
      "First Name": "first_name",
      "Last Name": "last_name",
    });
    expect(result).toEqual({
      Email: "email",
      "First Name": "first_name",
      "Last Name": "last_name",
    });
  });

  it("throws when no column is mapped to email", () => {
    expect(() =>
      buildMapping({
        Name: "first_name",
        Phone: "last_name",
      }),
    ).toThrow("email");
  });

  it("omits skip-sentinel entries from the result", () => {
    const result = buildMapping({
      Email: "email",
      Notes: SKIP_SENTINEL,
      Phone: "",
    });
    expect(result).toEqual({ Email: "email" });
    expect(Object.keys(result)).not.toContain("Notes");
    expect(Object.keys(result)).not.toContain("Phone");
  });

  it("throws on empty assignments", () => {
    expect(() => buildMapping({})).toThrow();
  });

  it("accepts a single email-only mapping", () => {
    expect(buildMapping({ address: "email" })).toEqual({ address: "email" });
  });
});

// ---------------------------------------------------------------------------
// parseCsvHeaders — tested by mocking PapaParse
// ---------------------------------------------------------------------------

/** Minimal shape of the config object parseCsvHeaders passes to Papa.parse. */
interface MockPapaConfig {
  preview?: number;
  header?: boolean;
  skipEmptyLines?: boolean;
  complete?: (results: {
    meta: { fields?: string[] } & Record<string, unknown>;
    data: unknown[];
  }) => void;
  error?: (err: { message: string }) => void;
}

describe("parseCsvHeaders", () => {
  // A single spy instance is reused across tests to avoid the
  // "Cannot redefine property" error from multiple vi.spyOn calls.
  // biome-ignore lint/suspicious/noExplicitAny: spy typing — intentional
  let parseSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    parseSpy = vi.spyOn(Papa, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
  });

  it("resolves with the header field names", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({
        meta: { fields: ["email", "first_name", "last_name"] },
        data: [],
      });
    });

    const file = new File(
      ["email,first_name,last_name\na@b.com,A,B"],
      "test.csv",
      { type: "text/csv" },
    );
    const headers = await parseCsvHeaders(file);
    expect(headers).toEqual(["email", "first_name", "last_name"]);
  });

  it("calls PapaParse with preview: 1 and header: true", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({ meta: { fields: ["col"] }, data: [] });
    });

    const file = new File(["col\nval"], "x.csv", { type: "text/csv" });
    await parseCsvHeaders(file);

    expect(parseSpy).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ preview: 1, header: true }),
    );
  });

  it("rejects when PapaParse reports an error", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.error?.({ message: "parse failure" });
    });

    const file = new File(["bad"], "bad.csv", { type: "text/csv" });
    await expect(parseCsvHeaders(file)).rejects.toThrow("parse failure");
  });

  it("resolves with empty array when meta.fields is absent", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({ meta: {}, data: [] });
    });

    const file = new File([""], "empty.csv", { type: "text/csv" });
    const headers = await parseCsvHeaders(file);
    expect(headers).toEqual([]);
  });
});
