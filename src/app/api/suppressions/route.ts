import {
  handleCreateSuppressionRequest,
  handleListSuppressionsRequest,
} from "@/lib/api/suppressions";

export async function GET(request: Request): Promise<Response> {
  return await handleListSuppressionsRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return await handleCreateSuppressionRequest(request);
}
