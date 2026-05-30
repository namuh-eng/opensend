import { BroadcastServiceError, createBroadcastService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBroadcastRouteUserId } from "../../auth";

const broadcastService = createBroadcastService();

function notFoundResponse() {
  return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userIdOrResponse = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updated = await broadcastService.sendBroadcast({ userId, id, body });

    return NextResponse.json({
      object: "broadcast",
      id: updated.id,
      status: updated.status,
      scheduled_at: updated.scheduledAt,
    });
  } catch (error) {
    if (error instanceof BroadcastServiceError) {
      if (error.code === "not_found") return notFoundResponse();
      if (error.code === "send_forbidden") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Failed to send broadcast:", error);
    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: 500 },
    );
  }
}
