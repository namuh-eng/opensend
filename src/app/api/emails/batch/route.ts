import { handlePostEmailBatchRequest } from "@/lib/api/emails/batch-send";

// ── POST /api/emails/batch ────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  return handlePostEmailBatchRequest(request);
}
