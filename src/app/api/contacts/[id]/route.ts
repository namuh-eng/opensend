import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { queueEvent } from "@/lib/events";
import { ContactServiceError, createContactService } from "@opensend/core";

type RouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

// Dashboard callers authenticate with a Better Auth session cookie; API
// callers send a full-access Bearer key. Resolve the user from whichever
// applies so contact detail/edit/delete work from the dashboard UI.
async function resolveUserId(auth: RouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

function contactService() {
  return createContactService();
}

function mapContactServiceError(error: unknown, fallback: string): Response {
  if (error instanceof ContactServiceError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

function toContactUpdateResponse(contact: {
  object: "contact";
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  properties: Record<string, string> | null;
  created_at: Date | string | null;
}) {
  return {
    object: contact.object,
    id: contact.id,
    email: contact.email,
    first_name: contact.first_name,
    last_name: contact.last_name,
    unsubscribed: contact.unsubscribed,
    properties: contact.properties,
    created_at: contact.created_at,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    const contact = await contactService().getContact(id, userId);
    return Response.json(contact);
  } catch (err) {
    return mapContactServiceError(err, "Failed to retrieve contact");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await contactService().updateContact({
      userId,
      idOrEmail: id,
      changes: body,
    });

    if (updated.changedFields.length > 0) {
      await queueEvent({
        type: "contact.updated",
        userId,
        payload: {
          id: updated.id,
          changed_fields: updated.changedFields,
          contact: updated.webhookPayload,
        },
      });
    }

    return Response.json(toContactUpdateResponse(updated));
  } catch (err) {
    return mapContactServiceError(err, "Failed to update contact");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    const deleted = await contactService().deleteContact(id, userId);

    await queueEvent({
      type: "contact.deleted",
      userId,
      payload: {
        id: deleted.id,
        email: deleted.email,
      },
    });

    return Response.json({
      object: "contact",
      id: deleted.id,
      deleted: true,
    });
  } catch (err) {
    return mapContactServiceError(err, "Failed to delete contact");
  }
}
