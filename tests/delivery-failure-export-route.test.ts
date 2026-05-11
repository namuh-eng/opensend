import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockExportFailures = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@opensend/core", () => ({
  createDeliveryFailureExportService: () => ({
    exportFailures: mockExportFailures,
  }),
}));

describe("dashboard delivery failure export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires dashboard session auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import(
      "@/app/api/dashboard/delivery-failures/export/route"
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/dashboard/delivery-failures/export",
      ),
    );

    expect(response.status).toBe(401);
    expect(mockExportFailures).not.toHaveBeenCalled();
  });

  it("exports CSV for the session user and normalized query filters", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-session" } });
    mockExportFailures.mockResolvedValue({
      csv: "id,recipient\nrow-1,a@example.com",
      rowCount: 1,
    });
    const { GET } = await import(
      "@/app/api/dashboard/delivery-failures/export/route"
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/dashboard/delivery-failures/export?statuses=bounced,suppressed&start_date=2026-05-01&end_date=2026-05-03&search=a%40example.com&limit=10",
      ),
    );

    await expect(response.text()).resolves.toBe(
      "id,recipient\nrow-1,a@example.com",
    );
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("x-opensend-export-rows")).toBe("1");
    expect(mockExportFailures).toHaveBeenCalledWith({
      userId: "user-session",
      statuses: ["bounced", "suppressed"],
      start: new Date("2026-05-01T00:00:00.000"),
      end: new Date("2026-05-03T23:59:59.999"),
      search: "a@example.com",
      limit: 10,
    });
  });
});
