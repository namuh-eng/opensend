import { EmailDetail } from "@/components/email-detail";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emailEvents, emailSuppressions, emails, logs } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const { id } = await params;
  const userId = session.user.id;

  const [emailResult] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.userId, userId)))
    .limit(1);

  if (!emailResult) {
    notFound();
  }

  const events = await db
    .select()
    .from(emailEvents)
    .where(and(eq(emailEvents.emailId, id), eq(emailEvents.userId, userId)))
    .orderBy(desc(emailEvents.receivedAt));

  const associatedLogs = await db
    .select({
      id: logs.id,
      method: logs.method,
      endpoint: logs.endpoint,
      status: logs.status,
      createdAt: logs.createdAt,
    })
    .from(logs)
    .where(
      and(
        eq(logs.userId, userId),
        sql`(${logs.document}->>'emailId' = ${id} OR ${logs.document}->'emailIds' ? ${id})`,
      ),
    )
    .orderBy(desc(logs.createdAt))
    .limit(10);

  const primaryRecipient = emailResult.to[0]?.toLowerCase();
  const suppression = primaryRecipient
    ? await db.query.emailSuppressions.findFirst({
        where: and(
          eq(emailSuppressions.userId, userId),
          eq(emailSuppressions.email, primaryRecipient),
        ),
      })
    : null;

  const emailData = {
    id: emailResult.id,
    from: emailResult.from,
    to: emailResult.to,
    subject: emailResult.subject,
    html: emailResult.html,
    text: emailResult.text,
    createdAt: emailResult.createdAt.toISOString(),
    scheduledAt: emailResult.scheduledAt?.toISOString() || null,
    tags: (emailResult.tags as Array<{ name: string; value: string }>) ?? [],
    headers: (emailResult.headers as Record<string, string>) ?? {},
    suppression: suppression
      ? {
          email: suppression.email,
          reason: suppression.reason,
          suppressedAt: suppression.suppressedAt.toISOString(),
        }
      : null,
    events: events.map((e) => ({
      type: e.type,
      timestamp: e.receivedAt.toISOString(),
    })),
    logs: associatedLogs.map((log) => ({
      id: log.id,
      method: log.method ?? "GET",
      endpoint: log.endpoint ?? "",
      statusCode: log.status ?? 0,
      createdAt: log.createdAt.toISOString(),
    })),
  };

  return <EmailDetail email={emailData} />;
}
