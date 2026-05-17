import Link from "next/link";

export default function TopicsUnsubscribePageEditorUnavailablePage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-fg">
          Unsubscribe page editor unavailable
        </h2>
        <p className="text-[14px] text-fg-2">
          Opensend still serves the default unsubscribe page for public topics,
          but dashboard customization is not available yet.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-bg-2 p-4">
        <p className="text-[13px] text-fg-2">
          Contacts can continue to manage their subscription preferences from
          unsubscribe links in sent emails. Return to Topics to manage the
          public topics that appear on that default page.
        </p>
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
