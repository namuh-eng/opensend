import { integrationConnectionIdSchema } from "@/lib/validation/integrations";
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

  const { id: rawId } = await params;
  const parsedId = integrationConnectionIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid integration id" }, { status: 400 });
  }
  const id = parsedId.data;
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
