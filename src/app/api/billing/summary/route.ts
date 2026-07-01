import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/billing";
import { createDefaultBillingSummaryService } from "@/lib/billing/summary";
import { NextResponse } from "next/server";

const billingSummaryService = createDefaultBillingSummaryService();

export async function GET() {
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 404 },
    );
  }

  const session = await getServerSession();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const summary = await billingSummaryService.getBillingSummary(
      session.user.id,
    );
    if (!summary) {
      return NextResponse.json(
        {
          error: "No active plan. Subscribe to Lite to use the hosted service.",
          code: "no_active_plan",
        },
        { status: 402 },
      );
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load billing summary:", error);
    return NextResponse.json(
      { error: "Failed to load billing summary" },
      { status: 500 },
    );
  }
}
