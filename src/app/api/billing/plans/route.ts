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

  try {
    return NextResponse.json(await billingSummaryService.listPlans());
  } catch (error) {
    console.error("Failed to list public plans:", error);
    return NextResponse.json(
      { error: "Failed to list plans" },
      { status: 500 },
    );
  }
}
