import { UnsubscribePageEditor } from "@/components/unsubscribe-page-editor";
import Link from "next/link";

export default function TopicsUnsubscribePageEditorPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/audience/topics" className="btn btn-ghost btn-sm w-fit">
          Back to topics
        </Link>
        <h2 className="text-xl font-semibold text-fg">
          Unsubscribe page customization
        </h2>
        <p className="text-[14px] text-fg-2">
          Customize the hosted preference page your contacts see after clicking
          an unsubscribe link. Changes take effect immediately for all new
          preference requests.
        </p>
      </div>

      <UnsubscribePageEditor />
    </div>
  );
}
