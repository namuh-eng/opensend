import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ status: templates.status })
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft templates can be published" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(templates)
      .set({
        status: "published",
        publishedAt: new Date(),
        hasUnpublishedVersions: false,
      })
      .where(eq(templates.id, id))
      .returning();

    return NextResponse.json({
      object: "template",
      id: updated.id,
      status: updated.status,
      published_at: updated.publishedAt,
      has_unpublished_versions: updated.hasUnpublishedVersions,
    });
  } catch (error) {
    console.error("Failed to publish template:", error);
    return NextResponse.json(
      { error: "Failed to publish template" },
      { status: 500 },
    );
  }
}
