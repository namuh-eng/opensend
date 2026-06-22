import { AudienceLayout } from "@/components/audience-layout";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AudienceLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  let stats = { all: 0, subscribed: 0, unsubscribed: 0 };

  try {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        unsubscribed: sql<number>`count(*) filter (where ${contacts.unsubscribed} = true)::int`,
      })
      .from(contacts)
      .where(eq(contacts.userId, session.user.id));

    const row = result[0];
    if (row) {
      stats = {
        all: row.total,
        subscribed: row.total - row.unsubscribed,
        unsubscribed: row.unsubscribed,
      };
    }
  } catch {
    // DB not available — show zeros
  }

  return <AudienceLayout stats={stats}>{children}</AudienceLayout>;
}
