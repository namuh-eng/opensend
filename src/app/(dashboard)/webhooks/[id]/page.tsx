import { WebhookDetail } from "@/components/webhook-detail";
import { getServerSession } from "@/lib/api-auth";
import { createWebhookService } from "@opensend/core";
import { notFound, redirect } from "next/navigation";

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/auth");

  const { id } = await params;
  const webhook = await createWebhookService().getWebhook(id, session.user.id);

  if (!webhook) notFound();

  return (
    <WebhookDetail
      webhook={{
        id: webhook.id,
        endpoint: webhook.endpoint,
        events: webhook.events,
        status: webhook.status,
        createdAt: webhook.createdAt.toISOString(),
        recentDeliveries: webhook.recentDeliveries.map((delivery) => ({
          id: delivery.id,
          status: delivery.status,
          attempt: delivery.attempt,
          statusCode: delivery.statusCode,
          attemptedAt: delivery.attemptedAt?.toISOString() ?? null,
          nextRetryAt: delivery.nextRetryAt?.toISOString() ?? null,
          createdAt: delivery.createdAt.toISOString(),
        })),
      }}
    />
  );
}
