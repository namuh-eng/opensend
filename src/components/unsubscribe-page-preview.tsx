import {
  OPENSEND_ATTRIBUTION_TEXT,
  OPENSEND_HOME_URL,
  isOpenSendAttribution,
} from "@/lib/opensend-attribution";
import { Check } from "lucide-react";

export type UnsubscribePreviewTopic = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly defaultSubscription: "opt_in" | "opt_out";
  readonly visibility: "private" | "public";
};

export type UnsubscribePreviewSettings = {
  readonly logoUrl: string;
  readonly brandColor: string;
  readonly headline: string;
  readonly message: string;
  readonly footerText: string;
};

type UnsubscribePagePreviewProps = {
  readonly mode: "preferences" | "success";
  readonly topics: readonly UnsubscribePreviewTopic[];
  readonly settings?: UnsubscribePreviewSettings;
  readonly size?: "compact" | "wide";
};

function isValidLogoUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

function publicTopics(
  topics: readonly UnsubscribePreviewTopic[],
): readonly UnsubscribePreviewTopic[] {
  return topics.filter((topic) => topic.visibility === "public");
}

export function UnsubscribePagePreview({
  mode,
  topics,
  settings,
  size = "compact",
}: UnsubscribePagePreviewProps) {
  const visibleTopics = publicTopics(topics);
  const hasPublicTopics = visibleTopics.length > 0;
  const hasMultiplePublicTopics = visibleTopics.length > 1;
  const isWide = size === "wide";
  const iconSize = isWide ? "size-24" : "size-20";
  const iconMargin = isWide ? "mb-8" : "mb-7";
  const headlineClass = isWide
    ? "mx-auto max-w-[720px] text-[32px] font-semibold leading-tight text-fg md:text-[36px]"
    : "mx-auto max-w-[280px] text-[28px] font-semibold leading-[1.08] text-fg";
  const cardClass = isWide
    ? "flex min-h-[420px] items-center justify-center rounded-[18px] border border-line-2 bg-bg px-6 py-12 text-center"
    : "rounded-[18px] border border-line-2 bg-bg px-6 py-9 text-center";
  const contentClass = isWide ? "w-full max-w-[560px]" : "";

  return (
    <div className={cardClass}>
      <div className={contentClass}>
        {settings && isValidLogoUrl(settings.logoUrl) && (
          <img
            src={settings.logoUrl}
            alt="Logo"
            className="mx-auto mb-6 max-h-12 max-w-[180px]"
          />
        )}
        <div
          className={`mx-auto ${iconMargin} grid ${iconSize} place-items-center rounded-full bg-fg text-bg`}
          style={
            mode === "success" && settings
              ? { color: settings.brandColor }
              : undefined
          }
        >
          <Check aria-hidden="true" className="size-8" strokeWidth={1.8} />
        </div>

        {mode === "success" ? (
          <>
            <h3 className={headlineClass}>
              {settings?.headline ?? "Your email preferences were updated."}
            </h3>
            {settings && (
              <p className="mx-auto mt-4 max-w-[560px] text-[14px] leading-6 text-fg-2">
                {settings.message}
              </p>
            )}
          </>
        ) : (
          <>
            <h3 className={headlineClass}>
              {hasPublicTopics
                ? "Subscription preferences"
                : "Do you want to unsubscribe?"}
            </h3>
            <p className="mx-auto mt-3 mb-7 max-w-[420px] text-[14px] leading-6 text-fg-2">
              {hasPublicTopics
                ? "Choose which messages you want to receive."
                : "Confirm your email preferences:"}
            </p>
            {hasPublicTopics && (
              <div className="mb-7 space-y-3 text-left">
                {visibleTopics.map((topic) => (
                  <label
                    key={topic.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-bg-card p-3 transition-colors hover:border-line-2"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={topic.defaultSubscription === "opt_in"}
                      className="mt-0.5 accent-white"
                      disabled
                    />
                    <div>
                      <div className="text-[14px] font-medium text-fg">
                        {topic.name}
                      </div>
                      {topic.description && (
                        <div className="mt-0.5 text-[13px] text-fg-3">
                          {topic.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {hasPublicTopics ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="h-11 w-full rounded-lg bg-fg px-6 text-[14px] font-semibold text-bg transition-opacity disabled:cursor-default disabled:opacity-90"
                  disabled
                >
                  Update preferences
                </button>
                {hasMultiplePublicTopics && (
                  <button
                    type="button"
                    className="h-11 w-full rounded-lg border border-line-2 bg-transparent px-6 text-[14px] font-semibold text-fg transition-colors disabled:cursor-default disabled:opacity-90"
                    disabled
                  >
                    Unsubscribe from all
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="mx-auto mt-3 h-11 w-full max-w-[460px] rounded-lg bg-fg-4 px-6 text-[14px] font-semibold text-fg disabled:cursor-default"
                disabled
              >
                Unsubscribe
              </button>
            )}
          </>
        )}

        <div className="mt-8 text-[12px] font-medium text-fg-3">
          {isOpenSendAttribution(
            settings?.footerText ?? OPENSEND_ATTRIBUTION_TEXT,
          ) ? (
            <a
              href={OPENSEND_HOME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-fg-2"
            >
              {OPENSEND_ATTRIBUTION_TEXT}
            </a>
          ) : (
            settings?.footerText
          )}
        </div>
      </div>
    </div>
  );
}
