import { WebhooksList } from "@/components/webhooks-list";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { SUPPORTED_WEBHOOK_EVENT_TYPES } from "@opensend/core/src/webhook-events";
import { desc } from "drizzle-orm";

export default async function WebhooksPage() {
  const allWebhooks = await db
    .select()
    .from(webhooks)
    .orderBy(desc(webhooks.createdAt));

  const data = allWebhooks.map((w) => ({
    id: w.id,
    url: w.url,
    status: w.status as "active" | "disabled",
    eventTypes: (w.eventTypes as string[]) ?? [],
    createdAt: w.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#F0F0F0]">Webhooks</h1>
      <WebhooksList
        supportedEventTypes={[...SUPPORTED_WEBHOOK_EVENT_TYPES]}
        webhooks={data}
      />
    </div>
  );
}
