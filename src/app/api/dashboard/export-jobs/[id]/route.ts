import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  DashboardExportJobNotFoundError,
  getDashboardExportJob,
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
    const job = await getDashboardExportJob({ userId: session.user.id, id });
    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof DashboardExportJobNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to read dashboard export job:", error);
    return NextResponse.json(
      { error: "Failed to read export job" },
      { status: 500 },
    );
  }
}
