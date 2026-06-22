import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
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
  // CSV file import is a dashboard-only feature, mirroring Resend: CSV upload
  // lives in the dashboard, while programmatic callers add contacts via the
  // JSON endpoints (POST /api/contacts, /api/contacts/bulk). Require an
  // authenticated dashboard session; there is no Bearer-key path here.
  const session = await getServerSession();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

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
    // Strip leading blank / comma-only junk rows (e.g. a `,,,,,,` row some
    // exporters prepend) so header:true uses the REAL header row. PapaParse's
    // `skipEmptyLines: "greedy"` does not skip a comma-only *header* row, so we
    // must remove it first. transformHeader trims so the keys match the trimmed
    // names the client mapper shows in parseCsvHeaders.
    const normalized = text.replace(/^(?:[\s,]*\r?\n)+/, "");
    const parseResult = Papa.parse(normalized, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
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
