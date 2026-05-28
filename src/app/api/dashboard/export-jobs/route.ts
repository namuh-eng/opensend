import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { filtersFromInput } from "@/lib/dashboard-export-api";
import {
  createDashboardExportJob,
  listDashboardExportJobs,
} from "@/lib/dashboard-export-jobs-service";
import { isDashboardExportResource } from "@/lib/dashboard-export-types";
import { type NextRequest, NextResponse } from "next/server";

type ExportJobBody = {
  resource?: unknown;
  filters?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(request: NextRequest): Promise<ExportJobBody> {
  try {
    const payload: unknown = await request.json();
    return isObject(payload) ? payload : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getServerSession();
  if (!session?.user?.id) return unauthorizedResponse();

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const exports = await listDashboardExportJobs({
    userId: session.user.id,
    limit: Number.isFinite(limitParam) ? limitParam : 50,
  });

  return NextResponse.json({ data: exports });
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await getServerSession();
  if (!session?.user?.id) return unauthorizedResponse();

  const body = await readBody(request);
  if (
    typeof body.resource !== "string" ||
    !isDashboardExportResource(body.resource)
  ) {
    return NextResponse.json(
      { error: "Unsupported export resource" },
      { status: 400 },
    );
  }

  try {
    const job = await createDashboardExportJob({
      userId: session.user.id,
      createdByUserId: session.user.id,
      createdByEmail: session.user.email ?? null,
      resource: body.resource,
      filters: filtersFromInput(isObject(body.filters) ? body.filters : {}),
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("Failed to create dashboard export job:", error);
    return NextResponse.json(
      { error: "Failed to create export job" },
      { status: 500 },
    );
  }
}
