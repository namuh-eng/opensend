import { WebhooksList } from "@/components/webhooks-list";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { SUPPORTED_WEBHOOK_EVENT_TYPES } from "@opensend/core/src/webhook-events";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function WebhooksPage() {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const allWebhooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.userId, session.user.id))
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
