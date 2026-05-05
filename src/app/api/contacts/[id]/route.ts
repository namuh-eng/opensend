import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { and, eq, or } from "drizzle-orm";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  const { id } = await params;

  try {
    const contact = await findContact(id, userId);

    if (!contact) {
      return Response.json({ error: "Contact not found" }, { status: 404 });
    }

    // Map internal topic shape to documented opt_in/opt_out shape
    const topics =
      (
        contact.topicSubscriptions as Array<{
          topicId: string;
          subscribed: boolean;
        }> | null
      )?.map((t) => ({
        id: t.topicId,
        subscription: t.subscribed ? "opt_in" : "opt_out",
      })) ?? [];

    return Response.json({
      object: "contact",
      id: contact.id,
      email: contact.email,
      first_name: contact.firstName,
      last_name: contact.lastName,
      unsubscribed: contact.unsubscribed,
      properties: contact.customProperties,
      segments: contact.segments ?? [],
      topics,
      created_at: contact.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve contact";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const contact = await findContact(id, userId);
    if (!contact) {
      return Response.json({ error: "Contact not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.email !== undefined) updateData.email = body.email;
    if (body.first_name !== undefined) updateData.firstName = body.first_name;
    if (body.last_name !== undefined) updateData.lastName = body.last_name;
    if (body.unsubscribed !== undefined)
      updateData.unsubscribed = body.unsubscribed;
    if (body.properties !== undefined)
      updateData.customProperties = body.properties;

    const [updated] = await db
      .update(contacts)
      .set(updateData)
      .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)))
      .returning();

    if (!updated) {
      return Response.json({ error: "Contact not found" }, { status: 404 });
    }

    return Response.json({
      object: "contact",
      id: updated.id,
      email: updated.email,
      first_name: updated.firstName,
      last_name: updated.lastName,
      unsubscribed: updated.unsubscribed,
      properties: updated.customProperties,
      created_at: updated.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update contact";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  const { id } = await params;

  try {
    const contact = await findContact(id, userId);
    if (!contact) {
      return Response.json({ error: "Contact not found" }, { status: 404 });
    }

    const [deleted] = await db
      .delete(contacts)
      .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)))
      .returning({ id: contacts.id });

    if (!deleted) {
      return Response.json({ error: "Contact not found" }, { status: 404 });
    }

    return Response.json({
      object: "contact",
      id: deleted.id,
      deleted: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete contact";
    return Response.json({ error: message }, { status: 500 });
  }
}
