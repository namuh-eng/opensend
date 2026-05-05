import { LogsListPage } from "@/components/logs-list-page";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logs } from "@/lib/db/schema";
import { type SQL, and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function LogsPage(props: {
  searchParams: Promise<{
    status?: string;
    method?: string;
    after?: string;
    before?: string;
    userAgent?: string;
    apiKeyId?: string;
  }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const searchParams = await props.searchParams;
  const status = searchParams.status;
  const method = searchParams.method;
  const after = searchParams.after;
  const before = searchParams.before;
  const userAgent = searchParams.userAgent;
  const apiKeyId = searchParams.apiKeyId;

  const conditions: SQL[] = [eq(logs.userId, session.user.id)];

  if (status) {
    if (status === "2xx") {
      conditions.push(and(gte(logs.status, 200), lte(logs.status, 299)) as SQL);
    } else if (status === "4xx") {
      conditions.push(and(gte(logs.status, 400), lte(logs.status, 499)) as SQL);
    } else if (status === "5xx") {
      conditions.push(gte(logs.status, 500) as SQL);
    } else if (!Number.isNaN(Number(status))) {
      conditions.push(eq(logs.status, Number(status)));
    }
  }

  if (method) {
    conditions.push(eq(logs.method, method.toUpperCase()));
  }

  if (after) {
    conditions.push(gte(logs.createdAt, new Date(after)));
  }

  if (before) {
    const beforeDate = new Date(before);
    beforeDate.setHours(23, 59, 59, 999);
    conditions.push(lte(logs.createdAt, beforeDate));
  }

  if (userAgent) {
    conditions.push(sql`${logs.userAgent} ILIKE ${`%${userAgent}%`}`);
  }

  if (apiKeyId) {
    conditions.push(sql`${logs.document}->>'apiKeyId' = ${apiKeyId}`);
  }

  let logRows: {
    id: string;
    method: string | null;
    endpoint: string | null;
    statusCode: number | null;
    createdAt: string;
  }[] = [];

  try {
    const rows = await db
      .select({
        id: logs.id,
        method: logs.method,
        endpoint: logs.endpoint,
        status: logs.status,
        createdAt: logs.createdAt,
      })
      .from(logs)
      .where(and(...conditions))
      .orderBy(desc(logs.createdAt))
      .limit(500);

    logRows = rows.map((r) => ({
      id: r.id,
      method: r.method,
      endpoint: r.endpoint,
      statusCode: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    logRows = [];
  }

  return <LogsListPage logs={logRows} />;
}
