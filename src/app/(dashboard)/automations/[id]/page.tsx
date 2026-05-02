import { AutomationDetail } from "@/components/automation-detail";

export const dynamic = "force-dynamic";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AutomationDetail automationId={id} />;
}
