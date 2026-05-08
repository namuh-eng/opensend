import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { contacts, segments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mappingStr = formData.get("mapping") as string;
    const segmentId = formData.get("segment_id") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mapping = JSON.parse(mappingStr || "{}") as Record<string, string>;
    const text = await file.text();
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });
    const rows = parseResult.data as Record<string, string>[];

    // Resolve segment if provided
    let segmentName = "";
    if (segmentId) {
      const seg = await db.query.segments.findFirst({
        where: and(eq(segments.id, segmentId), eq(segments.userId, userId)),
      });
      if (seg) segmentName = seg.name;
    }

    const createdIds: string[] = [];

    for (const row of rows) {
      const data: { email?: string; firstName?: string; lastName?: string } =
        {};
      const customProps: Record<string, string> = {};

      for (const [colName, colValue] of Object.entries(row)) {
        const mappedKey = mapping[colName];
        if (mappedKey) {
          const value = colValue?.trim();
          if (mappedKey === "email") data.email = value?.toLowerCase();
          else if (mappedKey === "first_name") data.firstName = value;
          else if (mappedKey === "last_name") data.lastName = value;
          else customProps[mappedKey] = value;
        }
      }

      if (!data.email) continue;

      // Simple upsert logic
      const existing = await db.query.contacts.findFirst({
        where: and(eq(contacts.email, data.email), eq(contacts.userId, userId)),
      });

      if (existing) {
        const currentSegments = (existing.segments as string[]) ?? [];
        const updatedSegments =
          segmentName && !currentSegments.includes(segmentName)
            ? [...currentSegments, segmentName]
            : currentSegments;

        await db
          .update(contacts)
          .set({
            firstName: data.firstName || existing.firstName,
            lastName: data.lastName || existing.lastName,
            segments: updatedSegments,
            customProperties: {
              ...((existing.customProperties as Record<string, string>) || {}),
              ...customProps,
            },
          })
          .where(
            and(eq(contacts.id, existing.id), eq(contacts.userId, userId)),
          );
        createdIds.push(existing.id);
      } else {
        const [inserted] = await db
          .insert(contacts)
          .values({
            email: data.email,
            firstName: data.firstName || null,
            lastName: data.lastName || null,
            segments: segmentName ? [segmentName] : null,
            customProperties: customProps,
            userId: userId,
          })
          .returning({ id: contacts.id });
        createdIds.push(inserted.id);
      }
    }

    return NextResponse.json({
      object: "import",
      created_count: createdIds.length,
      ids: createdIds,
    });
  } catch (error) {
    console.error("Failed contact import:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
