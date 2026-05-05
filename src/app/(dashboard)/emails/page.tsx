import { EmailsSendingPage } from "@/components/emails-sending-page";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { apiKeys, emails } from "@/lib/db/schema";

// emails.status maps to lastEvent in the UI
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

type EmailsPageSearchParams = Record<string, string | string[] | undefined>;

interface EmailsPageProps {
  searchParams?: Promise<EmailsPageSearchParams>;
}

function getSearchParam(
  searchParams: EmailsPageSearchParams,
  key: string,
): string {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function EmailsPage({
  searchParams,
}: EmailsPageProps = {}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const userId = session.user.id;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const statusFilter = (
    getSearchParam(resolvedSearchParams, "status") ||
    getSearchParam(resolvedSearchParams, "statuses")
  ).trim();

  let keys: { id: string; name: string }[] = [];
  let emailList: {
    id: string;
    to: string[];
    lastEvent: string;
    subject: string;
    createdAt: string;
    sentAt: string | null;
  }[] = [];

  try {
    const emailConditions = [eq(emails.userId, userId)];
    if (statusFilter && statusFilter !== "all") {
      emailConditions.push(eq(emails.status, statusFilter));
    }

    const [keysResult, emailsResult] = await Promise.all([
      db
        .select({ id: apiKeys.id, name: apiKeys.name })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt)),
      db
        .select({
          id: emails.id,
          to: emails.to,
          lastEvent: emails.status,
          subject: emails.subject,
          createdAt: emails.createdAt,
          sentAt: emails.sentAt,
        })
        .from(emails)
        .where(and(...emailConditions))
        .orderBy(desc(emails.createdAt))
        .limit(100),
    ]);
    keys = keysResult;
    emailList = emailsResult.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      sentAt: e.sentAt?.toISOString() ?? null,
    }));
  } catch {
    // DB unavailable — render with empty data
  }

  return <EmailsSendingPage apiKeys={keys} emails={emailList} />;
}
