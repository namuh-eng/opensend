import { AutomationsList } from "@/components/automations-list";

export const dynamic = "force-dynamic";

export default function AutomationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#F0F0F0] mb-6">
        Automations
      </h1>
      <AutomationsList />
    </div>
  );
}
