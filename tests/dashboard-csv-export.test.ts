import {
  type CsvHeader,
  type CsvRow,
  serializeDashboardCsv,
} from "@/lib/dashboard-export-types";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelect = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockCreateDashboardCsvExport = vi.hoisted(() => vi.fn());

class MockDashboardExportTooLargeError extends Error {
  readonly code = "export_too_large" as const;

  constructor(
    readonly resource: string,
    readonly limit: number,
  ) {
    super("too large");
  }
}

vi.mock("@/lib/db", () => ({
  db: { select: mockSelect },
}));

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/dashboard-export-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/dashboard-export-service")>();
  return {
    ...actual,
    DashboardExportTooLargeError: MockDashboardExportTooLargeError,
    createDashboardCsvExport: mockCreateDashboardCsvExport,
  };
});

describe("dashboard CSV export helpers", () => {
  it("escapes CSV values consistently", () => {
    const headers: readonly CsvHeader<"email" | "note">[] = [
      { key: "email", label: "email" },
      { key: "note", label: "note" },
    ];
    const rows: readonly CsvRow<"email" | "note">[] = [
      { email: 'quoted,"person"@example.com', note: "line\nbreak" },
      { email: "plain@example.com", note: null },
    ];

    expect(serializeDashboardCsv(headers, rows)).toBe(
      'email,note\n"quoted,""person""@example.com","line\nbreak"\nplain@example.com,',
    );
  });

  it("redacts API key secrets by exporting token previews only", async () => {
    const limit = vi.fn(async () => [
      {
        id: "key-1",
        name: "Production",
        tokenPreview: "os_abc...1234",
        tokenHash: "full-secret-hash-should-not-export",
        permission: "full_access",
        domain: null,
        lastUsedAt: new Date("2026-05-01T00:00:00.000Z"),
        createdAt: new Date("2026-04-30T00:00:00.000Z"),
      },
    ]);
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit }),
        }),
      }),
    });

    const { apiKeysExport } = await import("@/lib/dashboard-export-service");
    const { serializeDashboardCsv } = await import(
      "@/lib/dashboard-export-types"
    );
    const result = await apiKeysExport("user-1", { search: "Production" });
    const csv = serializeDashboardCsv(result.headers, result.rows);

    expect(csv).toContain("token_preview");
    expect(csv).toContain("os_abc...1234");
    expect(csv).not.toContain("token_hash");
    expect(csv).not.toContain("full-secret-hash-should-not-export");
    expect(limit).toHaveBeenCalledWith(1001);
  });
});

describe("dashboard CSV export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires dashboard session auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import(
      "@/app/api/dashboard/exports/[resource]/route"
    );

    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/exports/emails"),
      { params: Promise.resolve({ resource: "emails" }) },
    );

    expect(response.status).toBe(401);
    expect(mockCreateDashboardCsvExport).not.toHaveBeenCalled();
  });

  it("passes session user and normalized visible filters to the shared service", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-session" } });
    mockCreateDashboardCsvExport.mockResolvedValue({
      resource: "emails",
      rowCount: 1,
      csv: "id,to\nemail-1,a@example.com",
    });
    const { GET } = await import(
      "@/app/api/dashboard/exports/[resource]/route"
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/dashboard/exports/emails?search=a%40example.com&status=bounced&start_date=2026-05-01&end_date=2026-05-03&apiKeyId=key-1&segmentId=seg-1&region=us-east-1&permission=full_access&method=post&userAgent=Chrome",
      ),
      { params: Promise.resolve({ resource: "emails" }) },
    );

    await expect(response.text()).resolves.toBe("id,to\nemail-1,a@example.com");
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("emails-");
    expect(response.headers.get("x-opensend-export-rows")).toBe("1");
    expect(mockCreateDashboardCsvExport).toHaveBeenCalledWith({
      resource: "emails",
      userId: "user-session",
      filters: {
        search: "a@example.com",
        status: "bounced",
        start: new Date("2026-05-01T00:00:00.000"),
        end: new Date("2026-05-03T23:59:59.999"),
        apiKeyId: "key-1",
        segmentId: "seg-1",
        region: "us-east-1",
        permission: "full_access",
        method: "post",
        source: undefined,
        domain: undefined,
        topicId: undefined,
        userAgent: "Chrome",
      },
    });
  });

  it("returns a bounded staged response when the immediate export cap is exceeded", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-session" } });
    mockCreateDashboardCsvExport.mockRejectedValue(
      new MockDashboardExportTooLargeError("contacts", 1000),
    );
    const { GET } = await import(
      "@/app/api/dashboard/exports/[resource]/route"
    );

    const response = await GET(
      new NextRequest("http://localhost/api/dashboard/exports/contacts"),
      { params: Promise.resolve({ resource: "contacts" }) },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "too large",
      code: "export_too_large",
      resource: "contacts",
      limit: 1000,
    });
  });
});

describe("dashboard export schema fixtures", () => {
  it("keeps supported resource CSV headers versioned and stable", async () => {
    const { getDashboardExportSchema } = await import(
      "@/lib/dashboard-export-service"
    );

    expect(getDashboardExportSchema("emails")).toEqual({
      version: 1,
      headers: [
        "id",
        "to",
        "from",
        "subject",
        "status",
        "created_at",
        "sent_at",
        "scheduled_at",
      ],
    });
    expect(getDashboardExportSchema("email-events")).toEqual({
      version: 1,
      headers: ["id", "email_id", "source_id", "type", "received_at"],
    });
    expect(getDashboardExportSchema("contacts")).toEqual({
      version: 1,
      headers: [
        "id",
        "email",
        "first_name",
        "last_name",
        "status",
        "segments",
        "created_at",
      ],
    });
    expect(getDashboardExportSchema("segments")).toEqual({
      version: 1,
      headers: [
        "id",
        "name",
        "contacts_count",
        "unsubscribed_count",
        "created_at",
      ],
    });
    expect(getDashboardExportSchema("topics")).toEqual({
      version: 1,
      headers: [
        "id",
        "name",
        "description",
        "default_subscription",
        "visibility",
        "created_at",
      ],
    });
    expect(getDashboardExportSchema("suppressions")).toEqual({
      version: 1,
      headers: [
        "id",
        "email",
        "reason",
        "source",
        "source_email_id",
        "source_message_id",
        "suppressed_at",
        "updated_at",
      ],
    });
    expect(getDashboardExportSchema("webhook-deliveries")).toEqual({
      version: 1,
      headers: [
        "id",
        "webhook_id",
        "event_id",
        "event_type",
        "attempt",
        "status",
        "status_code",
        "attempted_at",
        "next_retry_at",
        "created_at",
      ],
    });
    expect(getDashboardExportSchema("logs")).toEqual({
      version: 1,
      headers: [
        "id",
        "method",
        "endpoint",
        "status",
        "api_key_id",
        "user_agent",
        "created_at",
      ],
    });
    expect(getDashboardExportSchema("broadcasts")).toEqual({
      version: 1,
      headers: [
        "id",
        "name",
        "status",
        "audience_id",
        "subject",
        "created_at",
        "scheduled_at",
      ],
    });
    expect(getDashboardExportSchema("automation-runs")).toEqual({
      version: 1,
      headers: [
        "id",
        "automation_id",
        "automation_name",
        "trigger_event_id",
        "contact_id",
        "status",
        "current_step_key",
        "started_at",
        "completed_at",
        "next_step_at",
        "failure_reason",
        "created_at",
        "updated_at",
      ],
    });
    expect(getDashboardExportSchema("domains")).toEqual({
      version: 1,
      headers: ["id", "name", "status", "region", "created_at"],
    });
    expect(getDashboardExportSchema("api-keys")).toEqual({
      version: 1,
      headers: [
        "id",
        "name",
        "token_preview",
        "permission",
        "domain",
        "last_used_at",
        "created_at",
      ],
    });
  });
});
