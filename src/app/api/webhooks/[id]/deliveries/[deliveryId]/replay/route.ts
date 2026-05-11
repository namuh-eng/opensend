import { handleReplayWebhookDeliveryRequest } from "@/lib/api/webhooks";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; deliveryId: string }> },
): Promise<Response> {
  const { id, deliveryId } = await params;
  return await handleReplayWebhookDeliveryRequest(request, id, deliveryId);
}
