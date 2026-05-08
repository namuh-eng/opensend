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
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Duplicate all fields except ID and reset status to draft
    const [duplicated] = await db
      .insert(templates)
      .values({
        name: `${existing.name} (Copy)`,
        alias: existing.alias ? `${existing.alias}-copy` : null,
        status: "draft",
        subject: existing.subject,
        from: existing.from,
        replyTo: existing.replyTo,
        previewText: existing.previewText,
        html: existing.html,
        text: existing.text,
        variables: existing.variables,
      })
      .returning();

    return NextResponse.json({
      object: "template",
      id: duplicated.id,
      name: duplicated.name,
      status: duplicated.status,
    });
  } catch (error) {
    console.error("Failed to duplicate template:", error);
    return NextResponse.json(
      { error: "Failed to duplicate template" },
      { status: 500 },
    );
  }
}
