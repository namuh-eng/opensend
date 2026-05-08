import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { contacts, segments, topics } from "@/lib/db/schema";
import { queueEvent } from "@/lib/events";
import { createContactSchema } from "@/lib/validation/contacts";
import { type SQL, and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

type ContactRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

type ContactWebhookRow = typeof contacts.$inferSelect;

function toContactWebhookPayload(contact: ContactWebhookRow) {
  return {
    id: contact.id,
    email: contact.email,
    first_name: contact.firstName,
    last_name: contact.lastName,
    unsubscribed: contact.unsubscribed,
    properties: contact.customProperties ?? {},
    segments: contact.segments ?? [],
    topics: contact.topicSubscriptions ?? [],
    created_at: contact.createdAt?.toISOString?.() ?? contact.createdAt,
  };
}

async function resolveUserId(auth: ContactRouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const result = createContactSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 422 },
      );
    }

    const validated = result.data;
    const email = validated.email.toLowerCase();

    // Resolve segment names if provided as IDs
    let resolvedSegments: string[] = [];
    if (validated.segments) {
      resolvedSegments = await Promise.all(
        validated.segments.map(async (s: string) => {
          const seg = await db.query.segments.findFirst({
            where: and(
              or(eq(segments.id, s), eq(segments.name, s)),
              eq(segments.userId, userId),
            ),
          });
          return seg ? seg.name : null;
        }),
      ).then((results) => results.filter((r): r is string => r !== null));
    }

    // Map topics to internal shape
    let resolvedTopics: Array<{ topicId: string; subscribed: boolean }> = [];
    if (validated.topics) {
      resolvedTopics = await Promise.all(
        validated.topics.map(
          async (t: string | { id: string; subscription?: string }) => {
            const topicId = typeof t === "string" ? t : t.id;
            const subscription =
              typeof t === "string" ? "opt_in" : t.subscription || "opt_in";
            const found = await db.query.topics.findFirst({
              where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
            });
            if (!found) return null;
            return {
              topicId: found.id,
              subscribed: subscription === "opt_in",
            };
          },
        ),
      ).then((results) =>
        results.filter(
          (r): r is { topicId: string; subscribed: boolean } => r !== null,
        ),
      );
    }

    // Attempt insertion - the uniqueIndex on email will throw on duplicate
    try {
      const [inserted] = await db
        .insert(contacts)
        .values({
          email,
          firstName: validated.first_name || null,
          lastName: validated.last_name || null,
          unsubscribed: validated.unsubscribed ?? false,
          customProperties:
            (validated.properties as Record<string, string>) || null,
          segments: resolvedSegments.length > 0 ? resolvedSegments : null,
          topicSubscriptions: resolvedTopics.length > 0 ? resolvedTopics : null,
          userId,
        })
        .returning();

      await queueEvent({
        type: "contact.created",
        userId,
        payload: toContactWebhookPayload(inserted),
      });

      return NextResponse.json(
        {
          object: "contact",
          id: inserted.id,
        },
        { status: 201 },
      );
    } catch (dbError) {
      if (
        dbError &&
        typeof dbError === "object" &&
        "code" in dbError &&
        dbError.code === "23505"
      ) {
        // PostgreSQL unique violation code
        return NextResponse.json(
          { error: "A contact with this email already exists" },
          { status: 409 },
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Failed to create contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit")) || 40),
  );
  const status = url.searchParams.get("status") || "";
  const segmentId = url.searchParams.get("segment_id") || "";
  const after = url.searchParams.get("after") || "";

  try {
    let segmentName = "";
    if (segmentId) {
      const [seg] = await db
        .select({ name: segments.name })
        .from(segments)
        .where(and(eq(segments.id, segmentId), eq(segments.userId, userId)))
        .limit(1);
      if (seg) {
        segmentName = seg.name;
      } else {
        return NextResponse.json({
          object: "list",
          data: [],
          has_more: false,
        });
      }
    }

    const conditions: SQL[] = [eq(contacts.userId, userId)];

    if (search) {
      conditions.push(
        or(
          ilike(contacts.email, `%${search}%`),
          ilike(contacts.firstName, `%${search}%`),
          ilike(contacts.lastName, `%${search}%`),
        ) as SQL,
      );
    }

    if (status === "subscribed") {
      conditions.push(eq(contacts.unsubscribed, false));
    } else if (status === "unsubscribed") {
      conditions.push(eq(contacts.unsubscribed, true));
    }

    if (segmentName) {
      conditions.push(sql`${contacts.segments} ? ${segmentName}`);
    }

    if (after) {
      conditions.push(lt(contacts.id, after));
    }

    const rows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        unsubscribed: contacts.unsubscribed,
        segments: contacts.segments,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;

    const data = dataRows.map((c) => ({
      id: c.id,
      email: c.email,
      first_name: c.firstName,
      last_name: c.lastName,
      unsubscribed: c.unsubscribed,
      firstName: c.firstName,
      lastName: c.lastName,
      status: c.unsubscribed ? "unsubscribed" : "subscribed",
      segments: (c.segments as string[]) ?? [],
      created_at: c.createdAt,
    }));

    return NextResponse.json({
      object: "list",
      data,
      has_more: hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 },
    );
  }
}
