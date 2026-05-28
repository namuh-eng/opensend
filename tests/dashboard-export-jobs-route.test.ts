import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockListDashboardExportJobs = vi.hoisted(() => vi.fn());
const mockCreateDashboardExportJob = vi.hoisted(() => vi.fn());
const mockGetDashboardExportJob = vi.hoisted(() => vi.fn());
const mockGetDashboardExportJobDownload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/dashboard-export-jobs-service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/dashboard-export-jobs-service")
    >();
  return {
    ...actual,
    listDashboardExportJobs: mockListDashboardExportJobs,
    createDashboardExportJob: mockCreateDashboardExportJob,
    getDashboardExportJob: mockGetDashboardExportJob,
    getDashboardExportJobDownload: mockGetDashboardExportJobDownload,
  };
});

function request(
  url: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(url, init);
}

function jsonRequest(url: string, body: unknown) {
  return request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const completedJob = {
  id: "job-1",
  resource: "emails",
  status: "completed",
  format: "csv",
  schemaVersion: 1,
  filters: { search: "export@example.com" },
  filename: "emails-2026-05-28.csv",
  rowCount: 1,
  byteSize: 42,
  error: null,
  createdByUserId: "user-1",
  createdByEmail: "user@example.com",
  createdAt: "2026-05-28T00:00:00.000Z",
  completedAt: "2026-05-28T00:00:00.000Z",
  expiresAt: "2026-06-04T00:00:00.000Z",
  downloadedAt: null,
  downloadCount: 0,
};

describe("dashboard export jobs API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("requires dashboard session auth for listing and creating", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const route = await import("@/app/api/dashboard/export-jobs/route");

    const listResponse = await route.GET(
      request("http://localhost/api/dashboard/export-jobs"),
    );
    const createResponse = await route.POST(
      jsonRequest("http://localhost/api/dashboard/export-jobs", {
        resource: "emails",
      }),
    );

    expect(listResponse.status).toBe(401);
    expect(createResponse.status).toBe(401);
    expect(mockListDashboardExportJobs).not.toHaveBeenCalled();
    expect(mockCreateDashboardExportJob).not.toHaveBeenCalled();
  });

  it("lists only session tenant export jobs", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    mockListDashboardExportJobs.mockResolvedValue([completedJob]);
    const route = await import("@/app/api/dashboard/export-jobs/route");

    const response = await route.GET(
      request("http://localhost/api/dashboard/export-jobs?limit=25"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [completedJob] });
    expect(mockListDashboardExportJobs).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 25,
    });
  });

  it("creates a tenant-scoped bounded export job with normalized filters", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    mockCreateDashboardExportJob.mockResolvedValue(completedJob);
    const route = await import("@/app/api/dashboard/export-jobs/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/dashboard/export-jobs", {
        resource: "emails",
        filters: {
          search: "export@example.com",
          status: "sent",
          start_date: "2026-05-01",
          end_date: "2026-05-03",
        },
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(completedJob);
    expect(mockCreateDashboardExportJob).toHaveBeenCalledWith({
      userId: "user-1",
      createdByUserId: "user-1",
      createdByEmail: "user@example.com",
      resource: "emails",
      filters: {
        search: "export@example.com",
        status: "sent",
        start: new Date("2026-05-01T00:00:00.000"),
        end: new Date("2026-05-03T23:59:59.999"),
        apiKeyId: undefined,
        segmentId: undefined,
        region: undefined,
        permission: undefined,
        method: undefined,
        source: undefined,
        domain: undefined,
        topicId: undefined,
        userAgent: undefined,
      },
    });
  });

  it("rechecks session tenant authorization at download time", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "tenant-a", email: "a@example.com" },
    });
    mockGetDashboardExportJobDownload.mockResolvedValue({
      filename: "emails-2026-05-28.csv",
      csv: "id,to\nemail-1,a@example.com",
      rowCount: 1,
    });
    const route = await import(
      "@/app/api/dashboard/export-jobs/[id]/download/route"
    );

    const response = await route.GET(
      request("http://localhost/api/dashboard/export-jobs/job-1/download"),
      { params: Promise.resolve({ id: "job-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("id,to\nemail-1,a@example.com");
    expect(response.headers.get("content-disposition")).toContain(
      "emails-2026-05-28.csv",
    );
    expect(mockGetDashboardExportJobDownload).toHaveBeenCalledWith({
      userId: "tenant-a",
      id: "job-1",
    });
  });

  it("does not reveal another tenant's export job on download", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "tenant-b" } });
    const { DashboardExportJobNotFoundError } = await import(
      "@/lib/dashboard-export-jobs-service"
    );
    mockGetDashboardExportJobDownload.mockRejectedValue(
      new DashboardExportJobNotFoundError(),
    );
    const route = await import(
      "@/app/api/dashboard/export-jobs/[id]/download/route"
    );

    const response = await route.GET(
      request("http://localhost/api/dashboard/export-jobs/job-from-a/download"),
      { params: Promise.resolve({ id: "job-from-a" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Export job not found",
    });
    expect(mockGetDashboardExportJobDownload).toHaveBeenCalledWith({
      userId: "tenant-b",
      id: "job-from-a",
    });
  });
});
