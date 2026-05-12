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
