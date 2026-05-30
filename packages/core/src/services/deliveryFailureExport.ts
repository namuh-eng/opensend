import {
  type DeliveryFailureEmailRow,
  type DeliveryFailureEmailStatus,
  type DeliveryFailureEventRow,
  type DeliveryFailureExportRepository,
  type DeliveryFailureSuppressionRow,
  deliveryFailureExportRepo,
} from "../db/repositories/deliveryFailureExportRepo";
import { escapeCsvValue } from "../security/csv-escape";

export const DELIVERY_FAILURE_EXPORT_STATUSES = [
  "bounced",
  "complained",
  "suppressed",
] as const;

export type DeliveryFailureExportStatus =
  (typeof DELIVERY_FAILURE_EXPORT_STATUSES)[number];

export type DeliveryFailureExportCsvRow = {
  id: string;
  recipient: string;
  status: DeliveryFailureExportStatus;
  reason: string;
  source_email_id: string;
  source_message_id: string;
  created_at: string;
  updated_at: string;
};

export type DeliveryFailureExportInput = {
  userId: string;
  statuses?: string[];
  start?: Date;
  end?: Date;
  search?: string;
  limit?: number;
};

export type DeliveryFailureExportResult = {
  rows: DeliveryFailureExportCsvRow[];
  csv: string;
  rowCount: number;
};

export const DELIVERY_FAILURE_EXPORT_HEADERS: Array<
  keyof DeliveryFailureExportCsvRow
> = [
  "id",
  "recipient",
  "status",
  "reason",
  "source_email_id",
  "source_message_id",
  "created_at",
  "updated_at",
];

const EMAIL_FAILURE_STATUSES = new Set<DeliveryFailureEmailStatus>([
  "bounced",
  "complained",
]);
const ALL_FAILURE_STATUSES = new Set<string>(DELIVERY_FAILURE_EXPORT_STATUSES);

function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return 1000;
  return Math.min(Math.max(Math.trunc(limit), 1), 5000);
}

function normalizeStatuses(
  statuses: string[] | undefined,
): DeliveryFailureExportStatus[] {
  const normalized = (statuses ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => ALL_FAILURE_STATUSES.has(value));

  if (normalized.length === 0) return [...DELIVERY_FAILURE_EXPORT_STATUSES];
  return [...new Set(normalized)] as DeliveryFailureExportStatus[];
}

function asEmailStatuses(
  statuses: DeliveryFailureExportStatus[],
): DeliveryFailureEmailStatus[] {
  return statuses.filter((status): status is DeliveryFailureEmailStatus =>
    EMAIL_FAILURE_STATUSES.has(status as DeliveryFailureEmailStatus),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function extractPayloadString(
  payload: unknown,
  keys: readonly string[],
): string | null {
  if (!isRecord(payload)) return null;

  for (const key of keys) {
    const value = readString(payload[key]);
    if (value) return value;
  }

  const mail = payload.mail;
  if (isRecord(mail)) {
    for (const key of keys) {
      const value = readString(mail[key]);
      if (value) return value;
    }
  }

  return null;
}

function reasonForEmailFailure(
  row: DeliveryFailureEmailRow,
  event: DeliveryFailureEventRow | undefined,
): string {
  return (
    row.providerLastErrorMessage ??
    extractPayloadString(event?.payload, [
      "reason",
      "bounceType",
      "complaintFeedbackType",
      "diagnosticCode",
      "status",
    ]) ??
    row.providerLastErrorCode ??
    row.status
  );
}

function sourceMessageIdForEvent(
  event: DeliveryFailureEventRow | undefined,
): string {
  return (
    extractPayloadString(event?.payload, [
      "sourceMessageId",
      "messageId",
      "message_id",
    ]) ??
    event?.sourceId ??
    ""
  );
}

function mapLatestEventByEmail(
  events: DeliveryFailureEventRow[],
): Map<string, DeliveryFailureEventRow> {
  const byEmail = new Map<string, DeliveryFailureEventRow>();
  for (const event of events) {
    if (event.emailId && !byEmail.has(event.emailId)) {
      byEmail.set(event.emailId, event);
    }
  }
  return byEmail;
}

function emailRowToCsvRow(
  row: DeliveryFailureEmailRow,
  event: DeliveryFailureEventRow | undefined,
): DeliveryFailureExportCsvRow {
  const updatedAt = event?.receivedAt ?? row.providerLastAttemptedAt;

  return {
    id: row.id,
    recipient: row.to.join("; "),
    status: row.status,
    reason: reasonForEmailFailure(row, event),
    source_email_id: row.id,
    source_message_id: sourceMessageIdForEvent(event),
    created_at: row.createdAt.toISOString(),
    updated_at: updatedAt?.toISOString() ?? "",
  };
}

function suppressionRowToCsvRow(
  row: DeliveryFailureSuppressionRow,
): DeliveryFailureExportCsvRow {
  return {
    id: row.id,
    recipient: row.email,
    status: "suppressed",
    reason: row.reason,
    source_email_id: row.sourceEmailId ?? "",
    source_message_id: row.sourceMessageId ?? "",
    created_at: row.suppressedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeDeliveryFailureCsv(
  rows: DeliveryFailureExportCsvRow[],
): string {
  return [
    DELIVERY_FAILURE_EXPORT_HEADERS.join(","),
    ...rows.map((row) =>
      DELIVERY_FAILURE_EXPORT_HEADERS.map((header) =>
        escapeCsvValue(row[header]),
      ).join(","),
    ),
  ].join("\n");
}

export type DeliveryFailureExportServiceDependencies = {
  repository?: DeliveryFailureExportRepository;
};

export function createDeliveryFailureExportService({
  repository = deliveryFailureExportRepo,
}: DeliveryFailureExportServiceDependencies = {}) {
  return {
    async exportFailures(
      input: DeliveryFailureExportInput,
    ): Promise<DeliveryFailureExportResult> {
      const statuses = normalizeStatuses(input.statuses);
      const emailStatuses = asEmailStatuses(statuses);
      const limit = normalizeLimit(input.limit);

      const [emailRows, suppressionRows] = await Promise.all([
        repository.listEmailFailures({
          userId: input.userId,
          statuses: emailStatuses,
          start: input.start,
          end: input.end,
          search: input.search,
          limit,
        }),
        statuses.includes("suppressed")
          ? repository.listSuppressionFailures({
              userId: input.userId,
              start: input.start,
              end: input.end,
              search: input.search,
              limit,
            })
          : Promise.resolve([]),
      ]);

      const events = await repository.listEventsForEmails({
        userId: input.userId,
        emailIds: emailRows.map((row) => row.id),
        statuses: emailStatuses,
      });
      const eventByEmail = mapLatestEventByEmail(events);

      const rows = [
        ...emailRows.map((row) =>
          emailRowToCsvRow(row, eventByEmail.get(row.id)),
        ),
        ...suppressionRows.map(suppressionRowToCsvRow),
      ]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);

      return {
        rows,
        csv: serializeDeliveryFailureCsv(rows),
        rowCount: rows.length,
      };
    },
  };
}
