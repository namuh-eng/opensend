import { SettingsPage as SettingsPageClient } from "@/components/settings-page";
import { isBillingEnabled } from "@/lib/billing";

function loadSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  if (!host || !port || !user) return null;
  return { host, port, user };
}

export default function SettingsPage() {
  return (
    <SettingsPageClient
      billingEnabled={isBillingEnabled()}
      smtpConfig={loadSmtpConfig()}
    />
  );
}
