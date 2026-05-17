"use client";

import { useMemo, useState } from "react";

interface InsightItem {
  id: string;
  name: string;
  status: "needs_attention" | "doing_great";
  details: string;
}

interface EmailInsightsProps {
  from: string;
  html: string | null;
  text: string | null;
}

function analyzeEmail(
  from: string,
  html: string | null,
  _text: string | null,
): InsightItem[] {
  const insights: InsightItem[] = [];
  const domain = from.split("@")[1] ?? "";
  const hasDot = domain.includes(".");
  const parts = domain.split(".");
  const isSubdomain = hasDot && parts.length > 2;

  // 1. DMARC
  insights.push({
    id: "dmarc",
    name: "Include valid DMARC record",
    status: "needs_attention",
    details:
      "DMARC (Domain-based Message Authentication, Reporting & Conformance) helps protect your domain from email spoofing. Add a DMARC DNS record to improve deliverability and prevent unauthorized use of your domain.",
  });

  // 2. Click tracking (disabled = good)
  insights.push({
    id: "click-tracking",
    name: "Disable click tracking",
    status: "doing_great",
    details:
      "Click tracking is disabled, which means your email links point directly to the intended destination without redirects. This improves deliverability and user trust.",
  });

  // 3. Open tracking (disabled = good)
  insights.push({
    id: "open-tracking",
    name: "Disable open tracking",
    status: "doing_great",
    details:
      "Open tracking is disabled. No invisible tracking pixel is embedded in your emails, which improves deliverability and respects recipient privacy.",
  });

  // 4. Subdomain sending
  insights.push({
    id: "subdomain",
    name: "Use a subdomain",
    status: isSubdomain ? "doing_great" : "needs_attention",
    details: isSubdomain
      ? "You are sending from a subdomain rather than your root domain. This protects your main domain's reputation and isolates transactional email reputation."
      : "You are sending from a root domain. Using a subdomain protects your main domain's reputation and isolates transactional email reputation.",
  });

  // 5. Link count — check for excessive links
  const linkMatches = html ? html.match(/<a\s/gi) : null;
  const linkCount = linkMatches ? linkMatches.length : 0;
  const tooManyLinks = linkCount > 20;
  insights.push({
    id: "link-urls",
    name: "Keep link count reasonable",
    status: tooManyLinks ? "needs_attention" : "doing_great",
    details: tooManyLinks
      ? `Your email contains ${linkCount} links. Having more than 20 links can trigger spam filters. Consider reducing the number of links.`
      : `Your email contains ${linkCount} link${linkCount !== 1 ? "s" : ""}, which is within a reasonable range.`,
  });

  // 6. Plain text version
  insights.push({
    id: "plain-text",
    name: "Include plain text version",
    status: _text ? "doing_great" : "needs_attention",
    details: _text
      ? "Your email includes a plain text version alongside the HTML. This improves accessibility and deliverability across different email clients."
      : "Your email is missing a plain text version. Including one improves accessibility and deliverability across different email clients.",
  });

  // 7. Body size
  const bodySize = html ? new Blob([html]).size : 0;
  const tooLarge = bodySize > 102400;
  insights.push({
    id: "body-size",
    name: "Keep body size under 100KB",
    status: tooLarge ? "needs_attention" : "doing_great",
    details: tooLarge
      ? `Your email body is ${Math.round(bodySize / 1024)}KB, which exceeds 100KB. Large emails are more likely to be clipped or flagged by email providers.`
      : "Your email body is under 100KB. Large emails are more likely to be clipped or flagged by email providers.",
  });

  // 8. No-reply address
  const isNoReply = /^no[-_]?reply@/i.test(from);
  insights.push({
    id: "no-reply",
    name: "Avoid no-reply addresses",
    status: isNoReply ? "needs_attention" : "doing_great",
    details: isNoReply
      ? "You are using a no-reply address. Using a real reply-to address improves engagement and deliverability."
      : "You are not using a no-reply address. Using a real reply-to address improves engagement and deliverability.",
  });

  // 9. Image count
  const imgMatches = html ? html.match(/<img\s/gi) : null;
  const imgCount = imgMatches ? imgMatches.length : 0;
  const tooManyImages = imgCount > 10;
  insights.push({
    id: "image-count",
    name: "Keep image count reasonable",
    status: tooManyImages ? "needs_attention" : "doing_great",
    details: tooManyImages
      ? `Your email contains ${imgCount} images. Having more than 10 images can slow loading and trigger spam filters. Consider reducing the number.`
      : `Your email contains ${imgCount} image${imgCount !== 1 ? "s" : ""}, which is within a reasonable range.`,
  });

  return insights;
}

function InsightAccordion({ item }: { item: InsightItem }) {
  const [expanded, setExpanded] = useState(false);
  const isWarning = item.status === "needs_attention";

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center gap-3 py-3 px-4 text-left hover:bg-bg-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="text-[13px] text-fg-2 shrink-0">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        {isWarning ? (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#f59e0b"
            className="shrink-0"
          >
            <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#4ade80"
            className="shrink-0"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        )}
        <span className="text-[14px] text-fg">{item.name}</span>
      </button>
      {expanded && (
        <div
          data-testid={`insight-detail-${item.id}`}
          className="px-4 pb-3 pl-14 text-[13px] text-fg-2 leading-relaxed"
        >
          {item.details}
        </div>
      )}
    </div>
  );
}

export function EmailInsights({ from, html, text }: EmailInsightsProps) {
  const insights = useMemo(
    () => analyzeEmail(from, html, text),
    [from, html, text],
  );
  const needsAttention = insights.filter((i) => i.status === "needs_attention");
  const doingGreat = insights.filter((i) => i.status === "doing_great");

  return (
    <div className="min-h-[300px]" data-testid="email-insights">
      {needsAttention.length > 0 && (
        <div data-testid="needs-attention-section" className="mb-6">
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-2 px-4">
            NEEDS ATTENTION
          </p>
          <div className="border border-line rounded-lg overflow-hidden">
            {needsAttention.map((item) => (
              <InsightAccordion key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
      {doingGreat.length > 0 && (
        <div data-testid="doing-great-section">
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-2 px-4">
            DOING GREAT
          </p>
          <div className="border border-line rounded-lg overflow-hidden">
            {doingGreat.map((item) => (
              <InsightAccordion key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { analyzeEmail };
export type { InsightItem };
