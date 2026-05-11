import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import { isBillingEnabled } from "@/lib/billing";
import { createDefaultBillingSummaryService } from "@/lib/billing/summary";
import { NextResponse } from "next/server";

const billingSummaryService = createDefaultBillingSummaryService();

// Dashboard-only internal endpoint
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    return NextResponse.json(
      await billingSummaryService.getUsage({
        billingEnabled: isBillingEnabled(),
        userId: session.user?.id,
      }),
    );
  } catch (error) {
    console.error("Failed to fetch usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 },
    );
  }
}
