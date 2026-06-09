import { UnsubscribePageEditor } from "@/components/unsubscribe-page-editor";
import Link from "next/link";

export default function TopicsUnsubscribePageEditorPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-fg">
          Unsubscribe page customization
        </h2>
        <p className="text-[14px] text-fg-2">
          Customize the confirmation page your contacts see after clicking an
          unsubscribe link. Changes take effect immediately for all new
          unsubscribe requests.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-bg-2 p-6">
        <UnsubscribePageEditor />
      </div>

      <Link
        href="/audience/topics"
        className="inline-flex rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-bg-card"
      >
        Back to topics
      </Link>
    </div>
  );
}
