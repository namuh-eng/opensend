import { createIntegrationService } from "@opensend/core";
import {
  authorizeIntegrationRoute,
  mapIntegrationCatalogItem,
  mapIntegrationConnection,
  mapIntegrationServiceError,
} from "./route-helpers";

function service() {
  return createIntegrationService();
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const includeConnections = url.searchParams.get("connections") === "true";

  try {
    if (includeConnections) {
      const result = await service().listConnections({ userId: auth.userId });
      return Response.json({
        object: "list",
        data: result.data.map(mapIntegrationConnection),
        has_more: result.hasMore,
      });
    }

    const catalog = await service().listCatalog({ userId: auth.userId });
    return Response.json({
      object: "integration_catalog",
      data: catalog.map(mapIntegrationCatalogItem),
    });
  } catch (error) {
    return mapIntegrationServiceError(error, "Failed to list integrations");
  }
}
