import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { receivedEmails } from "@/lib/db/schema";
import { and, desc, lt, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = request.nextUrl;
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 20, 1),
    100,
  );
  const after = url.searchParams.get("after") || "";
  const toFilter = url.searchParams.get("to")?.trim().toLowerCase();

  try {
    const conditions = [];
    if (after) {
      conditions.push(lt(receivedEmails.id, after));
    }
    if (toFilter) {
      conditions.push(sql`${receivedEmails.to} ? ${toFilter}`);
    }

    const rows = await db
      .select({
        id: receivedEmails.id,
        from: receivedEmails.from,
        to: receivedEmails.to,
        subject: receivedEmails.subject,
        createdAt: receivedEmails.createdAt,
      })
      .from(receivedEmails)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(receivedEmails.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      object: "list",
      data: dataRows.map((r) => ({
        id: r.id,
        from: r.from,
        to: r.to,
        subject: r.subject,
        created_at: r.createdAt,
      })),
      has_more: hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch received emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch received emails" },
      { status: 500 },
    );
  }
}
