import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { queueEvent } from "@/lib/events";
import { createContactSchema } from "@/lib/validation/contacts";
import { ContactServiceError, createContactService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

type ContactRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function resolveUserId(auth: ContactRouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

function contactService() {
  return createContactService();
}

function mapContactServiceError(error: unknown, fallback: string) {
  if (error instanceof ContactServiceError) {
    const status = error.code === "duplicate_email" ? 409 : 404;
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const result = createContactSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 422 },
      );
    }

    const created = await contactService().createContact({
      userId,
      email: result.data.email,
      firstName: result.data.first_name,
      lastName: result.data.last_name,
      unsubscribed: result.data.unsubscribed,
      properties: result.data.properties,
      segments: result.data.segments,
      topics: result.data.topics,
    });

    await queueEvent({
      type: "contact.created",
      userId,
      payload: created.webhookPayload,
    });

    return NextResponse.json(
      {
        object: "contact",
        id: created.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapContactServiceError(error, "Failed to create contact");
  }
}

export async function GET(request: Request) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  const url = new URL(request.url);

  try {
    const result = await contactService().listContacts({
      userId,
      search: url.searchParams.get("search") || "",
      limit: Number(url.searchParams.get("limit")) || 40,
      status: url.searchParams.get("status") || "",
      segmentId: url.searchParams.get("segment_id") || "",
      after: url.searchParams.get("after") || "",
    });

    return NextResponse.json({
      object: "list",
      data: result.data,
      has_more: result.hasMore,
    });
  } catch (error) {
    return mapContactServiceError(error, "Failed to fetch contacts");
  }
}
