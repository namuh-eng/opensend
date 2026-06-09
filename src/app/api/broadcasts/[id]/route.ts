import { BroadcastServiceError, createBroadcastService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBroadcastRouteUserId } from "../auth";

const broadcastService = createBroadcastService();

type BroadcastDetail = Awaited<
  ReturnType<typeof broadcastService.getBroadcast>
>;

function broadcastDetailResponse(broadcast: BroadcastDetail) {
  return NextResponse.json({
    object: "broadcast",
    id: broadcast.id,
    name: broadcast.name,
    status: broadcast.status,
    from: broadcast.from,
    subject: broadcast.subject,
    html: broadcast.html,
    text: broadcast.text,
    reply_to: broadcast.replyTo,
    preview_text: broadcast.previewText,
    audience_id: broadcast.audienceId,
    topic_id: broadcast.topicId,
    scheduled_at: broadcast.scheduledAt,
    created_at: broadcast.createdAt,
  });
}

function notFoundResponse() {
  return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
}

function deleteForbiddenResponse() {
  return NextResponse.json(
    { error: "Cannot delete a broadcast that is already sent or queued" },
    { status: 400 },
  );
}

export async function GET(
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
    const broadcast = await broadcastService.getBroadcast(userId, id);
    return broadcastDetailResponse(broadcast);
  } catch (error) {
    if (error instanceof BroadcastServiceError && error.code === "not_found") {
      return notFoundResponse();
    }

    console.error("Failed to fetch broadcast:", error);
    return NextResponse.json(
      { error: "Failed to fetch broadcast" },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const body = await request.json();
    const updated = await broadcastService.updateBroadcast({
      id,
      userId,
      body,
    });

    return broadcastDetailResponse(updated);
  } catch (error) {
    if (error instanceof BroadcastServiceError && error.code === "not_found") {
      return notFoundResponse();
    }

    console.error("Failed to update broadcast:", error);
    return NextResponse.json(
      { error: "Failed to update broadcast" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const deleted = await broadcastService.deleteBroadcast(userId, id);

    return NextResponse.json({
      object: "broadcast",
      id: deleted.id,
      deleted: true,
    });
  } catch (error) {
    if (error instanceof BroadcastServiceError) {
      if (error.code === "not_found") return notFoundResponse();
      if (error.code === "delete_forbidden") return deleteForbiddenResponse();
    }

    console.error("Failed to delete broadcast:", error);
    return NextResponse.json(
      { error: "Failed to delete broadcast" },
      { status: 500 },
    );
  }
}
