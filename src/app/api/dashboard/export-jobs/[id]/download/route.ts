import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  DashboardExportExpiredError,
  DashboardExportJobNotFoundError,
  DashboardExportNotReadyError,
  getDashboardExportJobDownload,
} from "@/lib/dashboard-export-jobs-service";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const { id } = await params;
    const download = await getDashboardExportJobDownload({
      userId: session.user.id,
      id,
    });
    return new NextResponse(download.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": `attachment; filename="${download.filename}"`,
        "x-opensend-export-rows": String(download.rowCount),
      },
    });
  } catch (error) {
    if (error instanceof DashboardExportJobNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DashboardExportExpiredError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 410 },
      );
    }
    if (error instanceof DashboardExportNotReadyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 409 },
      );
    }
    console.error("Failed to download dashboard export job:", error);
    return NextResponse.json(
      { error: "Failed to download export" },
      { status: 500 },
    );
  }
}
