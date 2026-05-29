import { EmailsHeader } from "@/components/emails-header";
import { ReceivingList } from "@/components/receiving-list";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { domains, receivingRoutes } from "@/lib/db/schema";
import { createForwardingRuleService } from "@opensend/core";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

const forwardingRuleService = createForwardingRuleService();

export default async function EmailsReceivingPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/auth");
  }

  const allDomains = await db
    .select()
    .from(domains)
    .where(eq(domains.userId, session.user.id))
    .orderBy(desc(domains.createdAt));

  const allRoutes = await db
    .select()
    .from(receivingRoutes)
    .where(eq(receivingRoutes.userId, session.user.id))
    .orderBy(desc(receivingRoutes.createdAt));

  const data = allDomains.map((d) => ({
    id: d.id,
    name: d.name,
    status: (d.status === "verified" ? "active" : "pending") as
      | "active"
      | "pending",
    createdAt: d.createdAt.toISOString(),
    receivingEnabled: Boolean(
      d.capabilities?.some(
        (capability) => capability.name === "receiving" && capability.enabled,
      ),
    ),
  }));

  const domainNames = new Map(
    allDomains.map((domain) => [domain.id, domain.name]),
  );
  const routeData = allRoutes.map((route) => {
    const domain = domainNames.get(route.domainId) ?? "";
    return {
      id: route.id,
      domain_id: route.domainId,
      domain,
      type: route.type as "exact" | "alias" | "catch_all",
      local_part: route.localPart,
      target_local_part: route.targetLocalPart,
      target_address: `${route.targetLocalPart}@${domain}`,
    };
  });
  const forwardingRules = await forwardingRuleService.listRules({
    userId: session.user.id,
  });
  const forwardingRuleData = forwardingRules.data.map((rule) => ({
    id: rule.id,
    domain_id: rule.domain_id,
    domain: rule.domain,
    route_id: rule.route_id,
    route_target_address: rule.route_target_address,
    destinations: rule.destinations,
    status: rule.status,
    invalid_reason: rule.invalid_reason,
    last_attempt: rule.last_attempt
      ? {
          id: rule.last_attempt.id,
          status: rule.last_attempt.status,
          reason: rule.last_attempt.reason,
          received_email_id: rule.last_attempt.received_email_id,
          forwarded_email_id: rule.last_attempt.forwarded_email_id,
          forwarded_email_status: rule.last_attempt.forwarded_email_status,
          error_message: rule.last_attempt.error_message,
          created_at: rule.last_attempt.created_at.toISOString(),
        }
      : null,
  }));

  return (
    <div>
      <EmailsHeader activeTab="receiving" />
      <ReceivingList
        domains={data}
        routes={routeData}
        forwardingRules={forwardingRuleData}
      />
    </div>
  );
}
