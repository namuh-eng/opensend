import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { createContactOperationsService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

const CONTACT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const CONTACT_IMPORT_ALLOWED_MIME = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

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

    if (file.size > CONTACT_IMPORT_MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 413 },
      );
    }

    const declaredMime = file.type?.toLowerCase().split(";")[0]?.trim() ?? "";
    const filename = (file.name ?? "").toLowerCase();
    const hasCsvExtension = filename.endsWith(".csv");
    if (
      declaredMime &&
      !CONTACT_IMPORT_ALLOWED_MIME.has(declaredMime) &&
      !hasCsvExtension
    ) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a CSV." },
        { status: 415 },
      );
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
