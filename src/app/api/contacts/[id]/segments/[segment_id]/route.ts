import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { contacts, contactsToSegments, segments } from "@/lib/db/schema";
import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

async function findContact(idOrEmail: string, userId: string) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrEmail,
    );

  return await db.query.contacts.findFirst({
    where: and(
      isUuid
        ? or(eq(contacts.id, idOrEmail), eq(contacts.email, idOrEmail))
        : eq(contacts.email, idOrEmail),
      eq(contacts.userId, userId),
    ),
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; segment_id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: idOrEmail, segment_id } = await params;

    const [contact, segment] = await Promise.all([
      findContact(idOrEmail, userId),
      db.query.segments.findFirst({
        where: and(eq(segments.id, segment_id), eq(segments.userId, userId)),
      }),
    ]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    // Update join table
    await db
      .insert(contactsToSegments)
      .values({
        contactId: contact.id,
        segmentId: segment.id,
      })
      .onConflictDoNothing();

    // Legacy sync (to be removed after migration)
    const existingSegments = (contact.segments as string[]) ?? [];
    if (!existingSegments.includes(segment.name)) {
      const updatedSegments = [...existingSegments, segment.name];
      await db
        .update(contacts)
        .set({ segments: updatedSegments })
        .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)));
    }

    return NextResponse.json({
      object: "contact_segment",
      contact_id: contact.id,
      segment_id: segment.id,
      added: true,
    });
  } catch (error) {
    console.error("Failed to add contact to segment:", error);
    return NextResponse.json(
      { error: "Failed to add contact to segment" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; segment_id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: idOrEmail, segment_id } = await params;

    const [contact, segment] = await Promise.all([
      findContact(idOrEmail, userId),
      db.query.segments.findFirst({
        where: and(eq(segments.id, segment_id), eq(segments.userId, userId)),
      }),
    ]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (!segment) {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    // Update join table
    await db
      .delete(contactsToSegments)
      .where(
        and(
          eq(contactsToSegments.contactId, contact.id),
          eq(contactsToSegments.segmentId, segment.id),
        ),
      );

    // Legacy sync (to be removed after migration)
    const existingSegments = (contact.segments as string[]) ?? [];
    if (existingSegments.includes(segment.name)) {
      const updatedSegments = existingSegments.filter(
        (s) => s !== segment.name,
      );
      await db
        .update(contacts)
        .set({ segments: updatedSegments })
        .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)));
    }

    return NextResponse.json({
      object: "contact_segment",
      contact_id: contact.id,
      segment_id: segment.id,
      deleted: true,
    });
  } catch (error) {
    console.error("Failed to remove contact from segment:", error);
    return NextResponse.json(
      { error: "Failed to remove contact from segment" },
      { status: 500 },
    );
  }
}
