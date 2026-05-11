import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { createDashboardAggregateService } from "@opensend/core";
import { NextResponse } from "next/server";

const dashboardAggregateService = createDashboardAggregateService();

// Dashboard-only internal endpoint
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const payload = await dashboardAggregateService.getUsage();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}
