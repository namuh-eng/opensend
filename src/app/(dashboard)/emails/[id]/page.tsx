import { EmailDetail } from "@/components/email-detail";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emailEvents, emailSuppressions, emails } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
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

  try {
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
      .where(eq(emailEvents.emailId, id))
      .orderBy(desc(emailEvents.receivedAt));

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
    };

    return <EmailDetail email={emailData} />;
  } catch {
    notFound();
  }
}
