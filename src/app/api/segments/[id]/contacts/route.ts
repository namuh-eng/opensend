import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { contacts, contactsToSegments, segments } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: segmentId } = await params;

    // Check if segment exists
    const [segment] = await db
      .select({ id: segments.id, name: segments.name })
      .from(segments)
      .where(and(eq(segments.id, segmentId), eq(segments.userId, userId)));

    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    const url = request.nextUrl;
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 20),
    );
    const after = url.searchParams.get("after") || "";

    // Join with join table
    const query = db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        unsubscribed: contacts.unsubscribed,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(
        contactsToSegments,
        eq(contacts.id, contactsToSegments.contactId),
      )
      .where(
        and(
          eq(contactsToSegments.segmentId, segmentId),
          eq(contacts.userId, userId),
        ),
      );

    const rows = await query.orderBy(desc(contacts.id)).limit(limit + 1);

    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;

    const data = dataRows.map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      status: c.unsubscribed ? "unsubscribed" : "subscribed",
      created_at: c.createdAt,
    }));

    return NextResponse.json({
      object: "list",
      data,
      has_more: hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch segment contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch segment contacts" },
      { status: 500 },
    );
  }
}
