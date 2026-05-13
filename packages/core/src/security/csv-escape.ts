const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Escape a value for inclusion in a CSV cell.
 * - Defends against CSV formula injection by prefixing leading triggers with a single quote.
 * - Wraps values containing commas, quotes, or newlines in double quotes and doubles internal quotes.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  const first = str.charAt(0);
  if (first.length > 0 && FORMULA_TRIGGERS.has(first)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
