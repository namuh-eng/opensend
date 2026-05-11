import { getServerSession } from "@/lib/api-auth";
import { getBillingBackend } from "@/lib/billing";
import { createDefaultBillingSessionService } from "@/lib/billing/session-factory";
import { NextResponse } from "next/server";

function getRequestOrigin(request: Request) {
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (getBillingBackend() !== "stripe") {
    return NextResponse.json(
      { error: "Billing is not enabled" },
      { status: 404 },
    );
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await createDefaultBillingSessionService().createPortalSession(
    {
      userId: session.user.id,
      origin: getRequestOrigin(request),
    },
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Stripe customer not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ url: result.url });
}
