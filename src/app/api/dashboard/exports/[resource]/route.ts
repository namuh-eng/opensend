import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { filtersFromSearchParams } from "@/lib/dashboard-export-api";
import {
  DashboardExportTooLargeError,
  createDashboardCsvExport,
} from "@/lib/dashboard-export-service";
import {
  type DashboardExportResource,
  dashboardExportFilename,
  isDashboardExportResource,
} from "@/lib/dashboard-export-types";
import { type NextRequest, NextResponse } from "next/server";

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
