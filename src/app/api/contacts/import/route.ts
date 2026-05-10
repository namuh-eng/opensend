import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { createContactOperationsService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

function contactOperationsService() {
  return createContactOperationsService();
}

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

    const result = await contactOperationsService().importContacts({
      userId,
      rows,
      mapping,
      segmentId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed contact import:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
