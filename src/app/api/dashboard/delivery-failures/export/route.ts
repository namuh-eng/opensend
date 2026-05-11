import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { createDeliveryFailureExportService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

const deliveryFailureExportService = createDeliveryFailureExportService();

function parseDate(value: string | null, boundary: "start" | "end") {
  if (!value) return undefined;

  const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function splitStatuses(value: string | null): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);
}

function csvResponse(csv: string, rowCount: number): Response {
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv;charset=utf-8",
      "content-disposition": `attachment; filename="delivery-failures-${today}.csv"`,
      "x-opensend-export-rows": String(rowCount),
    },
  });
}

// Dashboard-only internal endpoint. Public /api/emails remains API-key auth.
export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await deliveryFailureExportService.exportFailures({
      userId: session.user.id,
      statuses: splitStatuses(searchParams.get("statuses")),
      start: parseDate(
        searchParams.get("start_date") ?? searchParams.get("startDate"),
        "start",
      ),
      end: parseDate(
        searchParams.get("end_date") ?? searchParams.get("endDate"),
        "end",
      ),
      search: searchParams.get("search") ?? undefined,
      limit: Number(searchParams.get("limit")) || undefined,
    });

    return csvResponse(result.csv, result.rowCount);
  } catch (error) {
    console.error("Failed to export delivery failures:", error);
    return NextResponse.json(
      { error: "Failed to export delivery failures" },
      { status: 500 },
    );
  }
}
