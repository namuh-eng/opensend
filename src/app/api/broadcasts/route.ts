import { unauthorizedResponse } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { type SQL, and, desc, eq, ilike, lt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBroadcastRouteUserId } from "./auth";

export async function GET(request: NextRequest) {
  const userId = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  try {
    const url = request.nextUrl;
    const limit = Math.min(
      120,
      Math.max(1, Number(url.searchParams.get("limit")) || 40),
    );
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";
    const segmentId = url.searchParams.get("segmentId")?.trim() || "";
    const after = url.searchParams.get("after") || "";

    const conditions: SQL[] = [eq(broadcasts.userId, userId)];
    if (search) {
      conditions.push(ilike(broadcasts.name, `%${search}%`));
    }
    if (status) {
      conditions.push(
        eq(
          broadcasts.status,
          status as "draft" | "scheduled" | "queued" | "sent" | "failed",
        ),
      );
    }
    if (segmentId) {
      conditions.push(eq(broadcasts.audienceId, segmentId));
    }
    if (after) {
      conditions.push(lt(broadcasts.id, after));
    }

    const rows = await db
      .select({
        id: broadcasts.id,
        name: broadcasts.name,
        status: broadcasts.status,
        audienceId: broadcasts.audienceId,
        topicId: broadcasts.topicId,
        createdAt: broadcasts.createdAt,
        scheduledAt: broadcasts.scheduledAt,
      })
      .from(broadcasts)
      .where(and(...conditions))
      .orderBy(desc(broadcasts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      object: "list",
      data: dataRows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        audience_id: r.audienceId,
        topic_id: r.topicId,
        created_at: r.createdAt,
        scheduled_at: r.scheduledAt,
      })),
      has_more: hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch broadcasts:", error);
    return NextResponse.json(
      { error: "Failed to fetch broadcasts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const name = body.name?.trim() || "Untitled";
    const from = body.from?.trim();
    const subject = body.subject?.trim();
    const audienceId = body.segment_id || body.audience_id || null;

    if (!from || !subject || !audienceId) {
      return NextResponse.json(
        { error: "from, subject, and segment_id are required" },
        { status: 422 },
      );
    }

    const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;
    const shouldSend = body.send === true;

    const [broadcast] = await db
      .insert(broadcasts)
      .values({
        name,
        from,
        subject,
        audienceId,
        html: body.html || null,
        text: body.text || null,
        replyTo: body.reply_to || null,
        previewText: body.preview_text || null,
        topicId: body.topic_id || null,
        status: shouldSend ? (scheduledAt ? "scheduled" : "queued") : "draft",
        scheduledAt,
        userId,
      })
      .returning();

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
    console.error("Failed to create broadcast:", error);
    return NextResponse.json(
      { error: "Failed to create broadcast" },
      { status: 500 },
    );
  }
}
