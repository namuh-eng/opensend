import { TemplateDetail } from "@/components/template-detail";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const { id } = await params;
  const userId = session.user.id;

  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, userId)))
    .limit(1);

  if (!template) {
    notFound();
  }

  const templateData = {
    id: template.id,
    name: template.name,
    alias: template.alias,
    from: template.from,
    subject: template.subject,
    html: template.html,
    text: template.text,
    published: template.status === "published",
    variables: template.variables ?? [],
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.createdAt.toISOString(),
  };

  return <TemplateDetail template={templateData} />;
}
