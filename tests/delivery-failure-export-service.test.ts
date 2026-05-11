import {
  type DeliveryFailureExportCsvRow,
  type DeliveryFailureExportRepository,
  createDeliveryFailureExportService,
  serializeDeliveryFailureCsv,
} from "@opensend/core";
import { describe, expect, it, vi } from "vitest";

const bouncedAt = new Date("2026-05-01T12:00:00.000Z");
const complainedAt = new Date("2026-05-02T12:00:00.000Z");
const suppressedAt = new Date("2026-05-03T12:00:00.000Z");

function makeRepository(): DeliveryFailureExportRepository {
  return {
    listEmailFailures: vi.fn(async ({ statuses }) =>
      [
        {
          id: "11111111-1111-1111-1111-111111111111",
          to: ["bounce@example.com"],
          status: "bounced" as const,
          providerLastErrorMessage: null,
          providerLastErrorCode: null,
          providerLastAttemptedAt: null,
          createdAt: bouncedAt,
        },
        {
          id: "22222222-2222-2222-2222-222222222222",
          to: ["complaint@example.com", "alt@example.com"],
          status: "complained" as const,
          providerLastErrorMessage: "abuse report",
          providerLastErrorCode: "complaint",
          providerLastAttemptedAt: complainedAt,
          createdAt: complainedAt,
        },
      ].filter((row) => statuses.includes(row.status)),
    ),
    listEventsForEmails: vi.fn(async ({ emailIds }) =>
      [
        {
          emailId: "11111111-1111-1111-1111-111111111111",
          sourceId: "sns-bounce-1",
          type: "bounced",
          payload: {
            bounceType: "Permanent",
            mail: { messageId: "ses-msg-1" },
          },
          receivedAt: bouncedAt,
        },
        {
          emailId: "22222222-2222-2222-2222-222222222222",
          sourceId: "sns-complaint-1",
          type: "complained",
          payload: { complaintFeedbackType: "abuse" },
          receivedAt: complainedAt,
        },
      ].filter((event) => emailIds.includes(event.emailId)),
    ),
    listSuppressionFailures: vi.fn(async () => [
      {
        id: "33333333-3333-3333-3333-333333333333",
        email: "suppressed@example.com",
        reason: "bounced" as const,
        sourceEmailId: "11111111-1111-1111-1111-111111111111",
        sourceMessageId: "ses-msg-suppressed",
        suppressedAt,
        updatedAt: new Date("2026-05-03T12:30:00.000Z"),
      },
    ]),
  };
}

describe("delivery failure export service", () => {
  it("filters to requested failure statuses and serializes useful CSV fields", async () => {
    const repository = makeRepository();
    const service = createDeliveryFailureExportService({ repository });

    const result = await service.exportFailures({
      userId: "user-1",
      statuses: ["complained", "suppressed", "delivered"],
      start: new Date("2026-05-01T00:00:00.000Z"),
      end: new Date("2026-05-04T00:00:00.000Z"),
      search: "example.com",
      limit: 25,
    });

    expect(repository.listEmailFailures).toHaveBeenCalledWith({
      userId: "user-1",
      statuses: ["complained"],
      start: new Date("2026-05-01T00:00:00.000Z"),
      end: new Date("2026-05-04T00:00:00.000Z"),
      search: "example.com",
      limit: 25,
    });
    expect(repository.listSuppressionFailures).toHaveBeenCalledOnce();
    expect(result.rowCount).toBe(2);
    expect(result.rows).toEqual([
      {
        id: "33333333-3333-3333-3333-333333333333",
        recipient: "suppressed@example.com",
        status: "suppressed",
        reason: "bounced",
        source_email_id: "11111111-1111-1111-1111-111111111111",
        source_message_id: "ses-msg-suppressed",
        created_at: "2026-05-03T12:00:00.000Z",
        updated_at: "2026-05-03T12:30:00.000Z",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        recipient: "complaint@example.com; alt@example.com",
        status: "complained",
        reason: "abuse report",
        source_email_id: "22222222-2222-2222-2222-222222222222",
        source_message_id: "sns-complaint-1",
        created_at: "2026-05-02T12:00:00.000Z",
        updated_at: "2026-05-02T12:00:00.000Z",
      },
    ]);
    expect(result.csv).toContain(
      "id,recipient,status,reason,source_email_id,source_message_id,created_at,updated_at",
    );
    expect(result.csv).toContain("complaint@example.com; alt@example.com");
  });

  it("defaults to all failure statuses and preserves a header-only empty CSV", async () => {
    const repository: DeliveryFailureExportRepository = {
      listEmailFailures: vi.fn(async () => []),
      listEventsForEmails: vi.fn(async () => []),
      listSuppressionFailures: vi.fn(async () => []),
    };
    const service = createDeliveryFailureExportService({ repository });

    const result = await service.exportFailures({ userId: "user-empty" });

    expect(repository.listEmailFailures).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ["bounced", "complained"] }),
    );
    expect(repository.listSuppressionFailures).toHaveBeenCalledOnce();
    expect(result.rowCount).toBe(0);
    expect(result.csv).toBe(
      "id,recipient,status,reason,source_email_id,source_message_id,created_at,updated_at",
    );
  });

  it("escapes CSV values without dropping empty optional fields", () => {
    const rows: DeliveryFailureExportCsvRow[] = [
      {
        id: "id-1",
        recipient: 'quoted,"recipient"@example.com',
        status: "bounced",
        reason: "smtp\nfailed",
        source_email_id: "id-1",
        source_message_id: "",
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "",
      },
    ];

    expect(serializeDeliveryFailureCsv(rows)).toBe(
      'id,recipient,status,reason,source_email_id,source_message_id,created_at,updated_at\nid-1,"quoted,""recipient""@example.com",bounced,"smtp\nfailed",id-1,,2026-05-01T12:00:00.000Z,',
    );
  });
});
