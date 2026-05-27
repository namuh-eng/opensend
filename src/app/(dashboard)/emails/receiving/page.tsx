import { EmailsHeader } from "@/components/emails-header";
import { ReceivingList } from "@/components/receiving-list";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
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

  const data = allDomains.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status as "active" | "pending",
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div>
      <EmailsHeader activeTab="receiving" />
      <ReceivingList domains={data} />
    </div>
  );
}
