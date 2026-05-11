import {
  handleDeleteWebhookRequest,
  handleGetWebhookRequest,
  handleUpdateWebhookRequest,
} from "@/lib/api/webhooks";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return await handleGetWebhookRequest(request, id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return await handleUpdateWebhookRequest(request, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return await handleDeleteWebhookRequest(request, id);
}
