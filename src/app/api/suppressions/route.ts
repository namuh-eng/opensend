import { handleListSuppressionsRequest } from "@/lib/api/suppressions";

export async function GET(request: Request): Promise<Response> {
  return await handleListSuppressionsRequest(request);
}
