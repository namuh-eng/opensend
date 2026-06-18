import { EmailsHeader } from "@/components/emails-header";
import { ReceivingList } from "@/components/receiving-list";
import { notFound } from "next/navigation";

export default function ReceivingPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div>
      <EmailsHeader activeTab="receiving" />
      <ReceivingList
        domains={[]}
        routes={[]}
        forwardingRules={[]}
        receivedEmails={[]}
        useDemoData
      />
    </div>
  );
}
