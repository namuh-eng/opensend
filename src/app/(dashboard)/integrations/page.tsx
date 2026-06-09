import { IntegrationsPage } from "@/components/integrations-page";
import { getServerSession } from "@/lib/api-auth";
import { createIntegrationService } from "@opensend/core";
import { redirect } from "next/navigation";

export default async function IntegrationsDashboardPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/auth");

  const catalog = await createIntegrationService().listCatalog({
    userId: session.user.id,
  });

  return (
    <IntegrationsPage
      catalog={catalog.map((item) => ({
        provider: item.provider,
        name: item.name,
        description: item.description,
        status: item.status,
        connection: item.connection
          ? {
              id: item.connection.id,
              provider: item.connection.provider,
              name: item.connection.name,
              status: item.connection.status,
              scopes: item.connection.scopes,
              config: item.connection.config,
              health: item.connection.health,
              lastHealthCheckAt:
                item.connection.lastHealthCheckAt?.toISOString() ?? null,
              lastSyncAt: item.connection.lastSyncAt?.toISOString() ?? null,
              lastEventAt: item.connection.lastEventAt?.toISOString() ?? null,
              lastError: item.connection.lastError,
              createdAt: item.connection.createdAt.toISOString(),
              updatedAt: item.connection.updatedAt.toISOString(),
            }
          : null,
      }))}
    />
  );
}
