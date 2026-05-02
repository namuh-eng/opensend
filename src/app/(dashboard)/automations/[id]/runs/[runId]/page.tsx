import { AutomationRunDetail } from "@/components/automation-run-detail";

export const dynamic = "force-dynamic";

export default async function AutomationRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  return <AutomationRunDetail automationId={id} runId={runId} />;
}
