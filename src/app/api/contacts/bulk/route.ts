import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { contacts, segments, topics } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const body = await request.json();
    const { contact_ids, segment_id, topic_id, action } = body;

    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      return NextResponse.json(
        { error: "contact_ids must be a non-empty array" },
        { status: 422 },
      );
    }

    if (action === "add_to_segment") {
      if (!segment_id)
        return NextResponse.json(
          { error: "segment_id is required" },
          { status: 422 },
        );

      const segment = await db.query.segments.findFirst({
        where: and(eq(segments.id, segment_id), eq(segments.userId, userId)),
      });
      if (!segment)
        return NextResponse.json(
          { error: "Segment not found" },
          { status: 404 },
        );

      const targetContacts = await db.query.contacts.findMany({
        where: and(
          inArray(contacts.id, contact_ids),
          eq(contacts.userId, userId),
        ),
      });

      await Promise.all(
        targetContacts.map(async (c) => {
          const currentSegments = (c.segments as string[]) ?? [];
          if (!currentSegments.includes(segment.name)) {
            await db
              .update(contacts)
              .set({ segments: [...currentSegments, segment.name] })
              .where(and(eq(contacts.id, c.id), eq(contacts.userId, userId)));
          }
        }),
      );

      return NextResponse.json({
        object: "bulk_action",
        success: true,
        count: targetContacts.length,
      });
    }

    if (action === "subscribe_to_topic") {
      if (!topic_id)
        return NextResponse.json(
          { error: "topic_id is required" },
          { status: 422 },
        );

      const topic = await db.query.topics.findFirst({
        where: and(eq(topics.id, topic_id), eq(topics.userId, userId)),
      });
      if (!topic)
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });

      const targetContacts = await db.query.contacts.findMany({
        where: and(
          inArray(contacts.id, contact_ids),
          eq(contacts.userId, userId),
        ),
      });

      await Promise.all(
        targetContacts.map(async (c) => {
          const currentTopics =
            (c.topicSubscriptions as Array<{
              topicId: string;
              subscribed: boolean;
            }> | null) ?? [];
          const exists = currentTopics.some((t) => t.topicId === topic.id);
          if (!exists) {
            await db
              .update(contacts)
              .set({
                topicSubscriptions: [
                  ...currentTopics,
                  { topicId: topic.id, subscribed: true },
                ],
              })
              .where(and(eq(contacts.id, c.id), eq(contacts.userId, userId)));
          } else {
            const updated = currentTopics.map((t) =>
              t.topicId === topic.id ? { ...t, subscribed: true } : t,
            );
            await db
              .update(contacts)
              .set({ topicSubscriptions: updated })
              .where(and(eq(contacts.id, c.id), eq(contacts.userId, userId)));
          }
        }),
      );

      return NextResponse.json({
        object: "bulk_action",
        success: true,
        count: targetContacts.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed bulk action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
