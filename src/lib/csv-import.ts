import Papa from "papaparse";

/**
 * Reads only the first few rows of a CSV file using PapaParse preview mode —
 * does not load the full file into memory.
 *
 * Uses `skipEmptyLines: "greedy"` so comma-only junk rows (e.g. a leading
 * `,,,,,,` exported by some tools) are skipped and the real header row is
 * used. `preview` is > 1 because greedy-skipped rows still count toward the
 * preview budget, so preview: 1 would return nothing when a junk row leads.
 * Parses without `header` so we read the raw header cells directly, trim
 * them, and drop blank columns (trailing `,,,,`) — otherwise PapaParse
 * surfaces them as nameless `_1`, `_2`, … columns in the mapping UI.
 */
export function parseCsvHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      preview: 5,
      header: false,
      skipEmptyLines: "greedy",
      complete(results) {
        const firstRow = (results.data[0] as string[] | undefined) ?? [];
        const headers = firstRow
          .map((cell) => (typeof cell === "string" ? cell.trim() : ""))
          .filter((cell) => cell.length > 0);
        resolve(headers);
      },
      error(err) {
        reject(new Error(err.message));
      },
    });
  });
}

export const SKIP_SENTINEL = "— skip —";

export const KNOWN_FIELD_KEYS = ["email", "first_name", "last_name"] as const;
export type KnownFieldKey = (typeof KNOWN_FIELD_KEYS)[number];

/**
 * Converts a UI assignment map (csvColumn → fieldKey | SKIP_SENTINEL) into
 * the mapping object expected by POST /api/contacts/import.
 * Throws if no column is assigned to "email".
 */
export function buildMapping(
  assignments: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  let hasEmail = false;

  for (const [col, fieldKey] of Object.entries(assignments)) {
    if (fieldKey === SKIP_SENTINEL || fieldKey === "") continue;
    result[col] = fieldKey;
    if (fieldKey === "email") hasEmail = true;
  }

  if (!hasEmail) {
    throw new Error("At least one column must be mapped to 'email'.");
  }

  return result;
}
