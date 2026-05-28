import { EmailsHeader } from "@/components/emails-header";
import { ReceivingList } from "@/components/receiving-list";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { domains, receivingRoutes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

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

  return (
    <div>
      <EmailsHeader activeTab="receiving" />
      <ReceivingList domains={data} routes={routeData} />
    </div>
  );
}
