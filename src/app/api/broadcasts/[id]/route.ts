import { unauthorizedResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBroadcastRouteUserId } from "../auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveBroadcastRouteUserId(
    _request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .limit(1);

    if (!broadcast) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }

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
  } catch (error) {
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
  const userId = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.from !== undefined) updateData.from = body.from;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.html !== undefined) updateData.html = body.html;
    if (body.text !== undefined) updateData.text = body.text;
    if (body.reply_to !== undefined) updateData.replyTo = body.reply_to;
    if (body.replyTo !== undefined) updateData.replyTo = body.replyTo;
    if (body.preview_text !== undefined)
      updateData.previewText = body.preview_text;
    if (body.previewText !== undefined)
      updateData.previewText = body.previewText;
    if (body.audience_id !== undefined)
      updateData.audienceId = body.audience_id;
    if (body.audienceId !== undefined) updateData.audienceId = body.audienceId;
    if (body.topic_id !== undefined) updateData.topicId = body.topic_id;
    if (body.topicId !== undefined) updateData.topicId = body.topicId;
    if (body.scheduled_at !== undefined)
      updateData.scheduledAt = body.scheduled_at;
    if (body.scheduledAt !== undefined)
      updateData.scheduledAt = body.scheduledAt;

    const [updated] = await db
      .update(broadcasts)
      .set(updateData)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      object: "broadcast",
      id: updated.id,
      name: updated.name,
      status: updated.status,
      from: updated.from,
      subject: updated.subject,
      html: updated.html,
      text: updated.text,
      reply_to: updated.replyTo,
      preview_text: updated.previewText,
      audience_id: updated.audienceId,
      topic_id: updated.topicId,
      scheduled_at: updated.scheduledAt,
      created_at: updated.createdAt,
    });
  } catch (error) {
    console.error("Failed to update broadcast:", error);
    return NextResponse.json(
      { error: "Failed to update broadcast" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await resolveBroadcastRouteUserId(
    _request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;

    // Draft-guard logic
    const results = await db
      .select({ status: broadcasts.status })
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .limit(1);

    const existing = results ? results[0] : undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "draft" && existing.status !== "scheduled") {
      return NextResponse.json(
        { error: "Cannot delete a broadcast that is already sent or queued" },
        { status: 400 },
      );
    }

    const deleteResults = await db
      .delete(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .returning();

    const deleted = deleteResults ? deleteResults[0] : undefined;

    if (!deleted) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      object: "broadcast",
      id: deleted.id,
      deleted: true,
    });
  } catch (error) {
    console.error("Failed to delete broadcast:", error);
    return NextResponse.json(
      { error: "Failed to delete broadcast" },
      { status: 500 },
    );
  }
}
