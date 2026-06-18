import {
  type SuppressionListFilters,
  suppressionRepo,
} from "../db/repositories/suppressionRepo";
import type {
  SuppressionReason,
  SuppressionSourceMetadata,
  emailSuppressions,
} from "../db/schema";

export const SUPPRESSION_IMPORT_LIMIT = 200;
export const SUPPRESSION_IMPORT_MAX_BYTES = 64 * 1024;
export const SUPPRESSION_EXPORT_LIMIT = 1000;

export type CreateSuppressionInput = {
  userId: string;
  email: string;
  reason?: SuppressionReason;
};

type SuppressionRow = typeof emailSuppressions.$inferSelect;

export type SuppressionPublicItem = {
  id: string;
  object: "suppression";
  email: string;
  reason: SuppressionReason;
  scope: "user";
  source_event_id: string | null;
  source_email_id: string | null;
  source_message_id: string | null;
  metadata: SuppressionSourceMetadata | null;
  suppressed_at: string;
  updated_at: string;
};

export type SuppressionListResponse = {
  object: "list";
  scope: "user";
  data: SuppressionPublicItem[];
  has_more: boolean;
};

export type SuppressionDeleteResponse = {
  object: "suppression";
  deleted: true;
};

export type SuppressionImportRowError = {
  row: number;
  field: "file" | "email" | "reason" | "row";
  value?: string;
  message: string;
};

export type SuppressionImportResponse = {
  object: "suppression_import";
  imported_count: number;
  rejected_count: number;
  limit: number;
  data: SuppressionPublicItem[];
  errors: SuppressionImportRowError[];
};

export type SuppressionExportResponse = {
  object: "suppression_export";
  row_count: number;
  limit: number;
  csv: string;
};

export type SuppressionRepository = {
  list(options: {
    userId: string;
    limit: number;
    after?: string;
    filters?: SuppressionListFilters;
  }): Promise<{ data: SuppressionRow[]; hasMore: boolean }>;
  removeForUser(userId: string, email: string): Promise<Array<{ id: string }>>;
  suppress(input: {
    userId: string;
    email: string;
    reason: SuppressionReason;
    sourceEventId?: string | null;
    sourceEmailId?: string | null;
    sourceMessageId?: string | null;
    metadata?: SuppressionSourceMetadata | null;
  }): Promise<SuppressionRow>;
};

export type SuppressionServiceErrorCode = "not_found" | "export_too_large";

export class SuppressionServiceError extends Error {
  constructor(
    readonly code: SuppressionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SuppressionServiceError";
  }
}

export type SuppressionServiceDependencies = {
  repository?: SuppressionRepository;
};

export type ListSuppressionsInput = {
  userId: string;
  limit?: number;
  after?: string | null;
  search?: string | null;
  reason?: SuppressionReason | null;
  source?: "manual" | "operator" | "ses" | null;
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  domain?: string | null;
  topicId?: string | null;
};

export type ImportSuppressionsInput = {
  userId: string;
  csv: string;
};

export type ExportSuppressionsInput = Omit<ListSuppressionsInput, "limit"> & {
  limit?: number;
};

type ParsedImportRow = {
  row: number;
  email: string;
  reason: SuppressionReason;
};

type CsvParseResult = {
  rows: string[][];
  errors: SuppressionImportRowError[];
};

const SUPPRESSION_REASONS: readonly SuppressionReason[] = [
  "bounced",
  "complained",
  "manual",
];

const CSV_FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function normalizeLimit(limit: number | undefined): number {
  if (Number.isNaN(limit)) return 50;
  return Math.min(Math.max(limit || 50, 1), 100);
}

function normalizeExportLimit(limit: number | undefined): number {
  if (Number.isNaN(limit)) return SUPPRESSION_EXPORT_LIMIT;
  return Math.min(
    Math.max(limit || SUPPRESSION_EXPORT_LIMIT, 1),
    SUPPRESSION_EXPORT_LIMIT,
  );
}

function filtersFromInput(
  input: ListSuppressionsInput,
): SuppressionListFilters {
  return {
    search: input.search?.trim() || undefined,
    reason: input.reason ?? undefined,
    source: input.source ?? undefined,
    createdAfter: input.createdAfter ?? undefined,
    createdBefore: input.createdBefore ?? undefined,
    domain: input.domain?.trim() || undefined,
    topicId: input.topicId?.trim() || undefined,
  };
}

function toPublicItem(row: SuppressionRow): SuppressionPublicItem {
  return {
    id: row.id,
    object: "suppression",
    email: row.email,
    reason: row.reason,
    scope: "user",
    source_event_id: row.sourceEventId,
    source_email_id: row.sourceEmailId,
    source_message_id: row.sourceMessageId,
    metadata: row.metadata ?? null,
    suppressed_at: row.suppressedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function isSuppressionReason(value: string): value is SuppressionReason {
  return SUPPRESSION_REASONS.includes(value as SuppressionReason);
}

function parseCsv(input: string): CsvParseResult {
  const rows: string[][] = [];
  const errors: SuppressionImportRowError[] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let currentLine = 1;
  let fieldStartLine = 1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      fieldStartLine = currentLine;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      currentLine += 1;
      fieldStartLine = currentLine;
      continue;
    }

    if (char === "\n" || char === "\r") currentLine += 1;
    field += char;
  }

  if (inQuotes) {
    errors.push({
      row: fieldStartLine,
      field: "row",
      message: "Unclosed quoted CSV field.",
    });
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { rows, errors };
}

function parseImportRows(csv: string): {
  rows: ParsedImportRow[];
  errors: SuppressionImportRowError[];
} {
  const errors: SuppressionImportRowError[] = [];
  const byteLength = new TextEncoder().encode(csv).length;
  if (byteLength > SUPPRESSION_IMPORT_MAX_BYTES) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          field: "file",
          message: `CSV is too large. Import at most ${SUPPRESSION_IMPORT_MAX_BYTES} bytes per request.`,
        },
      ],
    };
  }

  const parsed = parseCsv(csv.trim());
  errors.push(...parsed.errors);

  const [rawHeader, ...rawRows] = parsed.rows;
  if (!rawHeader) {
    return {
      rows: [],
      errors: [
        { row: 0, field: "file", message: "CSV must include a header row." },
      ],
    };
  }

  const headers = rawHeader.map((value) => value.trim().toLowerCase());
  const emailIndex = headers.indexOf("email");
  const reasonIndex = headers.indexOf("reason");
  if (emailIndex === -1) {
    errors.push({
      row: 1,
      field: "email",
      message: "CSV header must include an email column.",
    });
  }

  const dataRows = rawRows.filter((cells) =>
    cells.some((cell) => cell.trim().length > 0),
  );
  if (dataRows.length > SUPPRESSION_IMPORT_LIMIT) {
    errors.push({
      row: 0,
      field: "file",
      message: `CSV import is limited to ${SUPPRESSION_IMPORT_LIMIT} suppression rows per request.`,
    });
  }

  const rows: ParsedImportRow[] = [];
  dataRows.slice(0, SUPPRESSION_IMPORT_LIMIT).forEach((cells, index) => {
    const rowNumber = index + 2;
    const email = emailIndex >= 0 ? (cells[emailIndex] ?? "").trim() : "";
    const reasonRaw = reasonIndex >= 0 ? (cells[reasonIndex] ?? "").trim() : "";
    const reason = reasonRaw || "manual";

    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 512) {
      errors.push({
        row: rowNumber,
        field: "email",
        value: email,
        message: "Email must be a valid address no longer than 512 characters.",
      });
    }

    if (!isSuppressionReason(reason)) {
      errors.push({
        row: rowNumber,
        field: "reason",
        value: reason,
        message: "Reason must be one of manual, bounced, or complained.",
      });
      return;
    }

    rows.push({ row: rowNumber, email, reason });
  });

  return { rows: errors.length === 0 ? rows : [], errors };
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const stringified = String(value ?? "");
  const neutralized =
    stringified.length > 0 && CSV_FORMULA_TRIGGERS.has(stringified.charAt(0))
      ? `'${stringified}`
      : stringified;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function suppressionsToCsv(rows: SuppressionPublicItem[]): string {
  const headers = [
    "id",
    "email",
    "reason",
    "source",
    "source_email_id",
    "source_message_id",
    "suppressed_at",
    "updated_at",
  ] as const;

  return [
    headers.join(","),
    ...rows.map((row) => {
      const source = row.metadata?.source ?? "";
      return [
        row.id,
        row.email,
        row.reason,
        source,
        row.source_email_id,
        row.source_message_id,
        row.suppressed_at,
        row.updated_at,
      ]
        .map(escapeCsvValue)
        .join(",");
    }),
  ].join("\n");
}

export function createSuppressionService({
  repository = suppressionRepo,
}: SuppressionServiceDependencies = {}) {
  return {
    async listSuppressions(
      input: ListSuppressionsInput,
    ): Promise<SuppressionListResponse> {
      const result = await repository.list({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        after: input.after || undefined,
        filters: filtersFromInput(input),
      });

      return {
        object: "list",
        scope: "user",
        data: result.data.map(toPublicItem),
        has_more: result.hasMore,
      };
    },

    async deleteSuppression(
      userId: string,
      email: string,
    ): Promise<SuppressionDeleteResponse> {
      const removed = await repository.removeForUser(userId, email);

      if (removed.length === 0) {
        throw new SuppressionServiceError("not_found", "Suppression not found");
      }

      return { object: "suppression", deleted: true };
    },

    async createSuppression(
      input: CreateSuppressionInput,
    ): Promise<SuppressionPublicItem> {
      const reason: SuppressionReason = input.reason ?? "manual";
      const row = await repository.suppress({
        userId: input.userId,
        email: input.email,
        reason,
        metadata: { source: "manual" },
      });
      return toPublicItem(row);
    },

    async importSuppressions(
      input: ImportSuppressionsInput,
    ): Promise<SuppressionImportResponse> {
      const parsed = parseImportRows(input.csv);
      if (parsed.errors.length > 0) {
        return {
          object: "suppression_import",
          imported_count: 0,
          rejected_count: parsed.errors.length,
          limit: SUPPRESSION_IMPORT_LIMIT,
          data: [],
          errors: parsed.errors,
        };
      }

      const imported: SuppressionPublicItem[] = [];
      for (const row of parsed.rows) {
        const record = await repository.suppress({
          userId: input.userId,
          email: row.email,
          reason: row.reason,
          metadata: { source: "manual", importRow: row.row },
        });
        imported.push(toPublicItem(record));
      }

      return {
        object: "suppression_import",
        imported_count: imported.length,
        rejected_count: 0,
        limit: SUPPRESSION_IMPORT_LIMIT,
        data: imported,
        errors: [],
      };
    },

    async exportSuppressions(
      input: ExportSuppressionsInput,
    ): Promise<SuppressionExportResponse> {
      const limit = normalizeExportLimit(input.limit);
      const result = await repository.list({
        userId: input.userId,
        limit,
        after: input.after || undefined,
        filters: filtersFromInput(input),
      });

      if (result.hasMore) {
        throw new SuppressionServiceError(
          "export_too_large",
          `More than ${limit.toLocaleString("en-US")} suppressions match these filters. Refine filters before exporting.`,
        );
      }

      const data = result.data.map(toPublicItem);
      return {
        object: "suppression_export",
        row_count: data.length,
        limit,
        csv: suppressionsToCsv(data),
      };
    },
  };
}

export const suppressionService = createSuppressionService();
