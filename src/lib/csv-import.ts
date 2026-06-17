import Papa from "papaparse";

/**
 * Reads only the header row of a CSV file using PapaParse preview mode.
 * O(first-row) on the client — does not load the full file into memory.
 */
export function parseCsvHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      preview: 1,
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const fields = results.meta.fields ?? [];
        resolve(fields);
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
