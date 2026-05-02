import { SettingsPage as SettingsPageClient } from "@/components/settings-page";
import { isBillingEnabled } from "@/lib/billing";

export default function SettingsPage() {
  return <SettingsPageClient billingEnabled={isBillingEnabled()} />;
}
