export const DASHBOARD_EXPORT_LIMIT = 1000;

export const DASHBOARD_EXPORT_RESOURCES = [
  "emails",
  "broadcasts",
  "contacts",
  "segments",
  "domains",
  "logs",
  "suppressions",
  "api-keys",
] as const;

export type DashboardExportResource =
  (typeof DASHBOARD_EXPORT_RESOURCES)[number];

export type CsvValue = string | number | boolean | Date | null | undefined;

export type CsvHeader<T extends string = string> = {
  key: T;
  label: string;
};

export type CsvRow<T extends string = string> = Record<T, CsvValue>;

export type DashboardCsvExport<T extends string = string> = {
  resource: DashboardExportResource;
  headers: readonly CsvHeader<T>[];
  rows: readonly CsvRow<T>[];
};

export function isDashboardExportResource(
  value: string,
): value is DashboardExportResource {
  return DASHBOARD_EXPORT_RESOURCES.includes(value as DashboardExportResource);
}

const CSV_FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function escapeCsvValue(value: CsvValue): string {
  const stringified =
    value instanceof Date ? value.toISOString() : String(value ?? "");
  // Prefix formula triggers with a leading apostrophe to neutralize
  // spreadsheet formula execution on import.
  const raw =
    stringified.length > 0 && CSV_FORMULA_TRIGGERS.has(stringified.charAt(0))
      ? `'${stringified}`
      : stringified;
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function serializeDashboardCsv<T extends string>(
  headers: readonly CsvHeader<T>[],
  rows: readonly CsvRow<T>[],
): string {
  return [
    headers.map((header) => escapeCsvValue(header.label)).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header.key])).join(","),
    ),
  ].join("\n");
}

export function dashboardExportFilename(
  resource: DashboardExportResource,
  now: Date = new Date(),
): string {
  return `${resource}-${now.toISOString().slice(0, 10)}.csv`;
}

export function dashboardExportLabel(
  resource: DashboardExportResource,
): string {
  switch (resource) {
    case "api-keys":
      return "API keys";
    case "emails":
      return "emails";
    case "broadcasts":
      return "broadcasts";
    case "contacts":
      return "contacts";
    case "segments":
      return "segments";
    case "domains":
      return "domains";
    case "logs":
      return "logs";
    case "suppressions":
      return "suppressions";
  }
}
