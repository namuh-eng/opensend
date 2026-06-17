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

  it("passes custom-property keys through unchanged", () => {
    // Any non-standard target key is forwarded verbatim; the server stores it
    // as a custom property. This is how the modal's "New property" / defined
    // property options reach the import endpoint.
    expect(
      buildMapping({
        Email: "email",
        id: "id",
        Created: "created_at",
        Notes: SKIP_SENTINEL,
      }),
    ).toEqual({ Email: "email", id: "id", Created: "created_at" });
  });
});

// ---------------------------------------------------------------------------
// parseCsvHeaders — tested by mocking PapaParse
// ---------------------------------------------------------------------------

/** Minimal shape of the config object parseCsvHeaders passes to Papa.parse. */
interface MockPapaConfig {
  preview?: number;
  header?: boolean;
  skipEmptyLines?: boolean | "greedy";
  complete?: (results: { data: unknown[] }) => void;
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

  it("resolves with the header cells from the first parsed row", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({ data: [["email", "first_name", "last_name"]] });
    });

    const file = new File(
      ["email,first_name,last_name\na@b.com,A,B"],
      "test.csv",
      { type: "text/csv" },
    );
    const headers = await parseCsvHeaders(file);
    expect(headers).toEqual(["email", "first_name", "last_name"]);
  });

  it("parses raw rows with greedy skipEmptyLines so junk rows are dropped", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({ data: [["col"]] });
    });

    const file = new File(["col\nval"], "x.csv", { type: "text/csv" });
    await parseCsvHeaders(file);

    expect(parseSpy).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        preview: 5,
        header: false,
        skipEmptyLines: "greedy",
      }),
    );
  });

  it("trims headers and drops blank columns (leading junk row + trailing empties)", async () => {
    // Simulates a CSV whose first non-empty row is `id,email,created_at,,,,`
    // after greedy skip dropped a leading `,,,,,,` row.
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({
        data: [["id", " email ", "created_at", "", "  ", ""]],
      });
    });

    const file = new File(["..."], "messy.csv", { type: "text/csv" });
    const headers = await parseCsvHeaders(file);
    expect(headers).toEqual(["id", "email", "created_at"]);
  });

  it("rejects when PapaParse reports an error", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.error?.({ message: "parse failure" });
    });

    const file = new File(["bad"], "bad.csv", { type: "text/csv" });
    await expect(parseCsvHeaders(file)).rejects.toThrow("parse failure");
  });

  it("resolves with empty array when there is no parsed row", async () => {
    parseSpy.mockImplementation((...args: unknown[]) => {
      const config = args[1] as MockPapaConfig | undefined;
      config?.complete?.({ data: [] });
    });

    const file = new File([""], "empty.csv", { type: "text/csv" });
    const headers = await parseCsvHeaders(file);
    expect(headers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integration: real PapaParse against the exact malformed shape that produced
// blank/`_1`..`_6` columns in the import UI (leading comma-only row + trailing
// empty columns). Uses the real parser (no spy) on a string to avoid relying
// on a DOM FileReader in the test environment.
// ---------------------------------------------------------------------------

describe("PapaParse greedy header parsing (integration)", () => {
  it("skips a comma-only leading row and yields the trimmed real header", () => {
    const csv = ",,,,,,\r\nid,email,created_at,,,,\r\n3,a@b.com,2026-03-23\r\n";
    const result = Papa.parse<string[]>(csv, {
      preview: 5,
      header: false,
      skipEmptyLines: "greedy",
    });
    const headers = (result.data[0] ?? [])
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    expect(headers).toEqual(["id", "email", "created_at"]);
  });
});
