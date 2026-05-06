import { LogDetail } from "@/components/log-detail";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logs } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const { id } = await params;

  const [logResult] = await db
    .select()
    .from(logs)
    .where(and(eq(logs.id, id), eq(logs.userId, session.user.id)))
    .limit(1);

  if (!logResult) {
    notFound();
  }

  const logData = {
    id: logResult.id,
    method: logResult.method ?? "GET",
    path: logResult.endpoint ?? "",
    statusCode: logResult.status ?? 0,
    duration: null as number | null,
    apiKeyId: logResult.apiKeyId,
    userAgent: logResult.userAgent,
    requestBody: logResult.requestBody as Record<string, unknown> | null,
    responseBody: logResult.responseBody as Record<string, unknown> | null,
    createdAt: logResult.createdAt.toISOString(),
  };

  return <LogDetail log={logData} />;
}
