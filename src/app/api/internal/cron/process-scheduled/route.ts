import { processScheduledAutomations } from "@/lib/workers/automation-runner";
import { processScheduledBroadcasts } from "@/lib/workers/broadcast-sender";
import { processScheduledEmails } from "@/lib/workers/scheduled-emails";
import { NextResponse } from "next/server";

/**
 * GET /api/internal/cron/process-scheduled
 *
 * Internal cron trigger for processing scheduled emails and broadcasts.
 * Should be called by a task scheduler (e.g. AWS EventBridge, Vercel Cron).
 */
export async function GET(request: Request) {
  // Simple auth check via header (shared secret)
  const authHeader = request.headers.get("x-cron-auth");
  const expectedToken = process.env.CRON_AUTH_TOKEN;

  if (expectedToken && authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [emailResult, broadcastResult, automationResult] = await Promise.all([
      processScheduledEmails(),
      processScheduledBroadcasts(),
      processScheduledAutomations(),
    ]);

    return NextResponse.json({
      ok: true,
      emails: emailResult,
      broadcasts: broadcastResult,
      automations: automationResult,
    });
  } catch (error) {
    console.error("Cron: Scheduled processing failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
