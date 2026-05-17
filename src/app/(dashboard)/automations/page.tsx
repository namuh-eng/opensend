import { AutomationsList } from "@/components/automations-list";

export const dynamic = "force-dynamic";

export default function AutomationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg mb-6">Automations</h1>
      <AutomationsList />
    </div>
  );
}
