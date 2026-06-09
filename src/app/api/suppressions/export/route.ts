import { handleExportSuppressionsRequest } from "@/lib/api/suppressions";

export async function GET(request: Request): Promise<Response> {
  return await handleExportSuppressionsRequest(request);
}
