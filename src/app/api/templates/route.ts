import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { normalizeTemplateVariablesInput } from "@/lib/templates/variables";
import { type SQL, and, count, desc, eq, ilike } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

function generateAlias(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-template"
  );
}

export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const url = request.nextUrl;
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status")?.trim() || "";

    const conditions: SQL[] = [];
    if (search) {
      conditions.push(ilike(templates.name, `%${search}%`));
    }
    if (status === "published") {
      conditions.push(eq(templates.status, "published"));
    } else if (status === "draft") {
      conditions.push(eq(templates.status, "draft"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count() })
      .from(templates)
      .where(whereClause);

    const rows = await db
      .select({
        id: templates.id,
        name: templates.name,
        alias: templates.alias,
        status: templates.status,
        currentVersionId: templates.currentVersionId,
        publishedAt: templates.publishedAt,
        hasUnpublishedVersions: templates.hasUnpublishedVersions,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(whereClause)
      .orderBy(desc(templates.createdAt))
      .limit(200);

    return NextResponse.json({
      object: "list",
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        alias: r.alias,
        status: r.status,
        current_version_id: r.currentVersionId,
        published_at: r.publishedAt,
        has_unpublished_versions: r.hasUnpublishedVersions,
        created_at: r.createdAt,
      })),
      total: totalRow?.count ?? 0,
    });
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const body = await request.json();
    const name = body.name?.trim();
    const html = body.html?.trim();

    if (!name || !html) {
      return NextResponse.json(
        { error: "name and html are required" },
        { status: 422 },
      );
    }

    const alias = body.alias?.trim() || generateAlias(name);

    const variableResult = normalizeTemplateVariablesInput(body.variables);
    if (!variableResult.ok) {
      return NextResponse.json(
        { error: variableResult.error },
        { status: 422 },
      );
    }

    const [template] = await db
      .insert(templates)
      .values({
        name,
        alias,
        html,
        subject: body.subject || null,
        from: body.from || null,
        replyTo: body.reply_to || null,
        previewText: body.preview_text || null,
        text: body.text || null,
        variables: variableResult.variables,
        status: "draft",
      })
      .returning();

    return NextResponse.json(
      {
        object: "template",
        id: template.id,
        name: template.name,
        alias: template.alias,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}
