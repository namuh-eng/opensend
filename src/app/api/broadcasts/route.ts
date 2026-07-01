import {
  checkMutationAllowed,
  quotaExceededResponse,
} from "@/lib/billing/quota";
import { BroadcastServiceError, createBroadcastService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBroadcastRouteUserId } from "./auth";

const broadcastService = createBroadcastService();

function broadcastListResponse(
  result: Awaited<ReturnType<typeof broadcastService.listBroadcasts>>,
) {
  return NextResponse.json({
    object: "list",
    data: result.data.map((broadcast) => ({
      id: broadcast.id,
      name: broadcast.name,
      status: broadcast.status,
      audience_id: broadcast.audienceId,
      topic_id: broadcast.topicId,
      created_at: broadcast.createdAt,
      scheduled_at: broadcast.scheduledAt,
    })),
    has_more: result.hasMore,
  });
}

export async function GET(request: NextRequest) {
  const userIdOrResponse = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  try {
    const url = request.nextUrl;
    const limit = Number(url.searchParams.get("limit")) || 40;
    const result = await broadcastService.listBroadcasts({
      userId,
      limit,
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      segmentId: url.searchParams.get("segmentId") ?? undefined,
      after: url.searchParams.get("after") ?? undefined,
    });

    return broadcastListResponse(result);
  } catch (error) {
    console.error("Failed to fetch broadcasts:", error);
    return NextResponse.json(
      { error: "Failed to fetch broadcasts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const userIdOrResponse = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;
  const gate = await checkMutationAllowed(userId);
  if (!gate.ok) return quotaExceededResponse(gate.info);

  try {
    const body = await request.json();
    const broadcast = await broadcastService.createBroadcast({ userId, body });

    return NextResponse.json(
      {
        object: "broadcast",
        id: broadcast.id,
        name: broadcast.name,
        status: broadcast.status,
        created_at: broadcast.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof BroadcastServiceError &&
      error.code === "invalid_input"
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("Failed to create broadcast:", error);
    return NextResponse.json(
      { error: "Failed to create broadcast" },
      { status: 500 },
    );
  }
}
