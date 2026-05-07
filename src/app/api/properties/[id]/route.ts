import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { contactProperties } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const [property] = await db
      .select()
      .from(contactProperties)
      .where(eq(contactProperties.id, id));

    if (!property) {
      return NextResponse.json(
        { error: "Contact property not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: property.id,
      key: property.key,
      name: property.name,
      type: property.type,
      fallback_value: property.fallbackValue,
      created_at: property.createdAt,
      updated_at: property.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch contact property:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact property" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: {
      name?: string;
      type?: "string" | "number" | "boolean" | "date";
      fallbackValue?: string | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.type !== undefined) updateData.type = body.type;
    if (body.fallback_value !== undefined)
      updateData.fallbackValue = body.fallback_value;

    const [updated] = await db
      .update(contactProperties)
      .set(updateData)
      .where(eq(contactProperties.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Contact property not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: updated.id,
      key: updated.key,
      name: updated.name,
      type: updated.type,
      fallback_value: updated.fallbackValue,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    });
  } catch (error) {
    console.error("Failed to update contact property:", error);
    return NextResponse.json(
      { error: "Failed to update contact property" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(contactProperties)
      .where(eq(contactProperties.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Contact property not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete contact property:", error);
    return NextResponse.json(
      { error: "Failed to delete contact property" },
      { status: 500 },
    );
  }
}
