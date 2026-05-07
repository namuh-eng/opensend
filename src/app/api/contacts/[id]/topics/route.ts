import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { contacts, topics } from "@/lib/db/schema";
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

function mapInternalToPublicSubscription(
  subscribed: boolean,
): "opt_in" | "opt_out" {
  return subscribed ? "opt_in" : "opt_out";
}

function mapPublicToInternalSubscription(
  subscription: "opt_in" | "opt_out",
): boolean {
  return subscription === "opt_in";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: idOrEmail } = await params;
    const contact = await findContact(idOrEmail, userId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const subscriptions =
      (contact.topicSubscriptions as Array<{
        topicId: string;
        subscribed: boolean;
      }> | null) ?? [];

    const data = await Promise.all(
      subscriptions.map(async (sub) => {
        const topic = await db.query.topics.findFirst({
          where: and(eq(topics.id, sub.topicId), eq(topics.userId, userId)),
        });
        if (!topic) return null;
        return {
          id: topic.id,
          name: topic.name,
          subscription: mapInternalToPublicSubscription(sub.subscribed),
        };
      }),
    ).then((results) => results.filter((r) => r !== null));

    return NextResponse.json({
      object: "list",
      data,
    });
  } catch (error) {
    console.error("Failed to fetch contact topics:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact topics" },
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
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: idOrEmail } = await params;
    const contact = await findContact(idOrEmail, userId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const body = await request.json();
    const newTopics = body.topics as Array<{
      id: string;
      subscription: "opt_in" | "opt_out";
    }>;

    if (!Array.isArray(newTopics)) {
      return NextResponse.json(
        { error: "topics must be an array" },
        { status: 422 },
      );
    }

    // Replace current subscriptions with new ones mapped to internal boolean
    const updatedSubscriptions = newTopics.map((t) => ({
      topicId: t.id,
      subscribed: mapPublicToInternalSubscription(t.subscription),
    }));

    await db
      .update(contacts)
      .set({ topicSubscriptions: updatedSubscriptions })
      .where(and(eq(contacts.id, contact.id), eq(contacts.userId, userId)));

    return NextResponse.json({
      object: "contact_topics",
      contact_id: contact.id,
      updated: true,
    });
  } catch (error) {
    console.error("Failed to update contact topics:", error);
    return NextResponse.json(
      { error: "Failed to update contact topics" },
      { status: 500 },
    );
  }
}
