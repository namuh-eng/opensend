import { createIntegrationService } from "@opensend/core";
import {
  authorizeIntegrationRoute,
  mapIntegrationConnection,
  mapIntegrationServiceError,
} from "../../../route-helpers";

function service() {
  return createIntegrationService();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  try {
    const result = await service().sendWebhookTestEvent({
      id,
      userId: auth.userId,
    });
    return Response.json({
      object: "integration_test_event",
      connection: mapIntegrationConnection(result.connection),
      delivery: result.delivery,
    });
  } catch (error) {
    return mapIntegrationServiceError(error, "Failed to send test event");
  }
}
