import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { contacts, segments } from "@/lib/db/schema";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: idOrEmail } = await params;
    const contact = await findContact(idOrEmail, userId);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const contactSegments = (contact.segments as string[]) ?? [];

    // Fetch segment details for the names in the contact's segments array
    const data = await Promise.all(
      contactSegments.map(async (name) => {
        const [seg] = await db
          .select({
            id: segments.id,
            name: segments.name,
            createdAt: segments.createdAt,
          })
          .from(segments)
          .where(and(eq(segments.name, name), eq(segments.userId, userId)))
          .limit(1);
        return seg
          ? { id: seg.id, name: seg.name, created_at: seg.createdAt }
          : null;
      }),
    ).then((results) => results.filter((r) => r !== null));

    return NextResponse.json({
      object: "list",
      data,
      has_more: false,
    });
  } catch (error) {
    console.error("Failed to fetch contact segments:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact segments" },
      { status: 500 },
    );
  }
}
