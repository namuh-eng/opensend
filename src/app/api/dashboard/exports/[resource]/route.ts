import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  type DashboardExportFilters,
  DashboardExportTooLargeError,
  createDashboardCsvExport,
} from "@/lib/dashboard-export-service";
import {
  type DashboardExportResource,
  dashboardExportFilename,
  isDashboardExportResource,
} from "@/lib/dashboard-export-types";
import { type NextRequest, NextResponse } from "next/server";

function parseDate(value: string | null, boundary: "start" | "end") {
  if (!value) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function searchParam(
  params: URLSearchParams,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

function filtersFromSearchParams(
  params: URLSearchParams,
): DashboardExportFilters {
  return {
    search: searchParam(params, "search", "q"),
    status: searchParam(params, "status", "statuses"),
    start: parseDate(
      searchParam(
        params,
        "start_date",
        "startDate",
        "date_from",
        "created_after",
        "after",
      ) ?? null,
      "start",
    ),
    end: parseDate(
      searchParam(
        params,
        "end_date",
        "endDate",
        "date_to",
        "created_before",
        "before",
      ) ?? null,
      "end",
    ),
    apiKeyId: searchParam(params, "api_key_id", "apiKeyId"),
    segmentId: searchParam(
      params,
      "segment_id",
      "segmentId",
      "audience_id",
      "audienceId",
    ),
    region: searchParam(params, "region"),
    permission: searchParam(params, "permission"),
    method: searchParam(params, "method"),
    source: searchParam(params, "source"),
    domain: searchParam(params, "domain"),
    topicId: searchParam(params, "topic_id", "topicId"),
    userAgent: searchParam(params, "user_agent", "userAgent"),
  };
}

function csvResponse(
  csv: string,
  rowCount: number,
  resource: DashboardExportResource,
): Response {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv;charset=utf-8",
      "content-disposition": `attachment; filename="${dashboardExportFilename(resource)}"`,
      "x-opensend-export-rows": String(rowCount),
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
): Promise<Response> {
  const session = await getServerSession();
  if (!session?.user?.id) return unauthorizedResponse();

  const { resource: resourceParam } = await params;
  if (!isDashboardExportResource(resourceParam)) {
    return NextResponse.json(
      { error: "Unknown export resource" },
      { status: 404 },
    );
  }

  try {
    const result = await createDashboardCsvExport({
      resource: resourceParam,
      userId: session.user.id,
      filters: filtersFromSearchParams(request.nextUrl.searchParams),
    });

    return csvResponse(result.csv, result.rowCount, result.resource);
  } catch (error) {
    if (error instanceof DashboardExportTooLargeError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          resource: error.resource,
          limit: error.limit,
        },
        { status: 413 },
      );
    }

    console.error("Failed to export dashboard CSV:", error);
    return NextResponse.json(
      { error: "Failed to export dashboard CSV" },
      { status: 500 },
    );
  }
}
