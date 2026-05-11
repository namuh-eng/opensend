import Link from "next/link";

export default function TopicsUnsubscribePageEditorUnavailablePage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-[#F0F0F0]">
          Unsubscribe page editor unavailable
        </h2>
        <p className="text-[14px] text-[#A1A4A5]">
          Opensend still serves the default unsubscribe page for public topics,
          but dashboard customization is not available yet.
        </p>
      </div>

      <div className="rounded-lg border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.5)] p-4">
        <p className="text-[13px] text-[#A1A4A5]">
          Contacts can continue to manage their subscription preferences from
          unsubscribe links in sent emails. Return to Topics to manage the
          public topics that appear on that default page.
        </p>
      </div>

      <Link
        href="/audience/topics"
        className="inline-flex rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] font-medium text-[#F0F0F0] transition-colors hover:bg-[rgba(24,25,28,1)]"
      >
        Back to topics
      </Link>
    </div>
  );
}
