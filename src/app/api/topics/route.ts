import {
  authorizeDashboardOrApiKey,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { topics } from "@/lib/db/schema";
import { and, asc, count, desc, eq, ilike, lt } from "drizzle-orm";
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
      conditions.push(ilike(topics.name, `%${search}%`));
    }
    if (after) {
      conditions.push(lt(topics.id, after));
    }

    const rows = await db
      .select({
        id: topics.id,
        name: topics.name,
        description: topics.description,
        defaultSubscription: topics.defaultSubscription,
        visibility: topics.visibility,
        createdAt: topics.createdAt,
      })
      .from(topics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(topics.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const dataRows = hasMore ? rows.slice(0, limit) : rows;

    const totalCount = await db.$count(
      topics,
      conditions.length > 0 ? and(...conditions) : undefined,
    );

    return NextResponse.json({
      object: "list",
      data: dataRows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        default_subscription: r.defaultSubscription,
        visibility: r.visibility,
        created_at: r.createdAt,
      })),
      has_more: hasMore,
      total: Number(totalCount),
    });
  } catch (error) {
    console.error("Failed to fetch topics:", error);
    return NextResponse.json(
      { error: "Failed to fetch topics" },
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

    const description = body.description?.trim() || null;
    if (description && description.length > 200) {
      return NextResponse.json(
        { error: "Description must be 200 characters or less" },
        { status: 422 },
      );
    }

    const defaultSubscription =
      (body.default_subscription || body.defaultSubscription) === "opt_in"
        ? "opt_in"
        : "opt_out";
    const visibility = body.visibility === "private" ? "private" : "public";

    const [topic] = await db
      .insert(topics)
      .values({
        name,
        description,
        defaultSubscription,
        visibility,
      })
      .returning();

    return NextResponse.json(
      {
        object: "topic",
        id: topic.id,
        name: topic.name,
        description: topic.description,
        defaultSubscription: topic.defaultSubscription,
        visibility: topic.visibility,
        createdAt: topic.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create topic:", error);
    return NextResponse.json(
      { error: "Failed to create topic" },
      { status: 500 },
    );
  }
}
