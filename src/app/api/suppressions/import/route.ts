import { handleImportSuppressionsRequest } from "@/lib/api/suppressions";

export async function POST(request: Request): Promise<Response> {
  return await handleImportSuppressionsRequest(request);
}
