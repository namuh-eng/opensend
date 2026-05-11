import {
  handleCreateWebhookRequest,
  handleListWebhooksRequest,
} from "@/lib/api/webhooks";

export async function GET(request: Request): Promise<Response> {
  return await handleListWebhooksRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return await handleCreateWebhookRequest(request);
}
