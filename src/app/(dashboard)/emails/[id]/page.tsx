import { EmailDetail } from "@/components/email-detail";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emailEvents, emailSuppressions, emails, logs } from "@/lib/db/schema";
import {
  createEmailTraceService,
  getThreadForOutboundEmail,
  toEmailEventTraceItem,
} from "@opensend/core";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

const emailTraceService = createEmailTraceService();

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
    .orderBy(asc(emailEvents.receivedAt));

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
  const [suppression, trace] = await Promise.all([
    primaryRecipient
      ? db.query.emailSuppressions.findFirst({
          where: and(
            eq(emailSuppressions.userId, userId),
            eq(emailSuppressions.email, primaryRecipient),
          ),
        })
      : null,
    emailTraceService.getTrace(userId, id),
  ]);

  const emailData = {
    id: emailResult.id,
    from: emailResult.from,
    to: emailResult.to,
    subject: emailResult.subject,
    html: emailResult.html,
    text: emailResult.text,
    replyAddress: emailResult.replyAddress,
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
    events: events.map((event) => {
      const trace = toEmailEventTraceItem(event);
      return {
        id: trace.id,
        type: trace.type,
        timestamp: trace.created_at.toISOString(),
        summary: trace.summary,
        details: trace.details,
      };
    }),
    logs: associatedLogs.map((log) => ({
      id: log.id,
      method: log.method ?? "GET",
      endpoint: log.endpoint ?? "",
      statusCode: log.status ?? 0,
      createdAt: log.createdAt.toISOString(),
    })),
    trace: trace.data.map((item) => ({
      id: item.id,
      source: item.source,
      type: item.type,
      timestamp: item.created_at.toISOString(),
      summary: item.summary,
      details: item.details,
      relatedId: item.related_id,
      relatedUrl: item.related_url,
    })),
    thread: await getThreadForOutboundEmail({
      userId,
      emailId: emailResult.id,
    }).then((thread) => ({
      threadId: thread.thread_id,
      matchStatus: thread.match_status,
      originalEmailId: thread.original_email_id,
      contactId: thread.contact_id,
      messages: thread.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        subject: message.subject,
        from: message.from,
        to: message.to,
        text: message.text,
        html: message.html,
        createdAt: message.created_at.toISOString(),
      })),
    })),
  };

  return <EmailDetail email={emailData} />;
}
