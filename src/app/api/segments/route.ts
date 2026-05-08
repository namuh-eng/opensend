import {
  authorizeDashboardOrApiKey,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { segments } from "@/lib/db/schema";
import { and, asc, count, desc, ilike, lt } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  try {
    const url = request.nextUrl;
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 20),
    );
    const search = url.searchParams.get("search")?.trim() || "";
    const after = url.searchParams.get("after") || "";

    const conditions = [];
    if (search) {
      conditions.push(ilike(segments.name, `%${search}%`));
    }
    if (after) {
      conditions.push(lt(segments.id, after));
    }

    const rows = await db
      .select({
        id: segments.id,
        name: segments.name,
        createdAt: segments.createdAt,
      })
      .from(segments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(segments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;

    const totalCount = await db.$count(
      segments,
      conditions.length > 0 ? and(...conditions) : undefined,
    );

    return NextResponse.json({
      object: "list",
      data: dataRows.map((r) => ({
        id: r.id,
        name: r.name,
        created_at: r.createdAt,
      })),
      has_more: hasMore,
      total: Number(totalCount),
    });
  } catch (error) {
    console.error("Failed to fetch segments:", error);
    return NextResponse.json(
      { error: "Failed to fetch segments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  try {
    const body = await request.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [segment] = await db
      .insert(segments)
      .values({ name })
      .returning({ id: segments.id, name: segments.name });

    return NextResponse.json(
      {
        object: "segment",
        id: segment.id,
        name: segment.name,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create segment:", error);
    return NextResponse.json(
      { error: "Failed to create segment" },
      { status: 500 },
    );
  }
}
