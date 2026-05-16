// ABOUTME: Settings Usage tab — read-only quota dashboard showing Transactional, Marketing, and Team limits

"use client";

import Link from "next/link";

export interface UsageData {
  plan: {
    name: string;
    slug: string;
  };
  transactional: {
    monthlyUsed: number;
    monthlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
  };
  marketing: {
    contactsUsed: number;
    contactsLimit: number;
    segmentsUsed: number;
    segmentsLimit: number;
    broadcastsLimit: "Unlimited";
  };
  team: {
    domainsUsed: number;
    domainsLimit: number;
    rateLimit: number;
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function QuotaIndicator({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  const ratio = limit > 0 ? used / limit : 0;
  const atLimit = ratio >= 1;
  const circumference = 2 * Math.PI * 7;
  const dashOffset = circumference - ratio * circumference;
  const strokeColor = atLimit ? "#EF4444" : ratio > 0.8 ? "#F59E0B" : "#3B82F6";

  return (
    <svg
      className={`quota-indicator${atLimit ? " at-limit" : ""}`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="rgba(176,199,217,0.145)"
        strokeWidth="2.5"
      />
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}

function QuotaRow({
  label,
  value,
  used,
  limit,
}: {
  label: string;
  value: string;
  used?: number;
  limit?: number;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {used !== undefined && limit !== undefined ? (
          <QuotaIndicator used={used} limit={limit} />
        ) : (
          <svg
            className="quota-indicator"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <circle
              cx="10"
              cy="10"
              r="7"
              fill="none"
              stroke="rgba(176,199,217,0.145)"
              strokeWidth="2.5"
            />
          </svg>
        )}
        <span className="text-[14px] text-fg-2">{label}</span>
      </div>
      <span className="text-[14px] text-fg">{value}</span>
    </div>
  );
}

function UpgradeAffordance({ billingEnabled }: { billingEnabled: boolean }) {
  if (billingEnabled) {
    return (
      <Link
        href="/settings/billing/plans"
        className="inline-flex rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-card"
      >
        Upgrade
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled
        className="rounded-md border border-line bg-bg-2 px-3 py-1.5 text-[13px] font-medium text-fg-2 opacity-70"
      >
        Upgrade unavailable
      </button>
      <p className="text-[12px] text-fg-2">
        Billing is disabled for this installation, so plan upgrades are not
        available here.
      </p>
    </div>
  );
}

function QuotaSection({
  title,
  description,
  planName,
  billingEnabled,
  overLimitMessage,
  children,
}: {
  title: string;
  description: string;
  planName: string;
  billingEnabled: boolean;
  overLimitMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 border-b border-line pb-8 last:mb-0 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-12">
        {/* Left side — title, description, upgrade */}
        <div className="max-w-[340px] shrink-0">
          <h2 className="mb-2 text-[18px] font-semibold text-fg">{title}</h2>
          <p className="mb-4 text-[14px] leading-relaxed text-fg-2">
            {description}
          </p>
          <UpgradeAffordance billingEnabled={billingEnabled} />
        </div>

        {/* Right side — plan badge + quota rows */}
        <div className="flex-1">
          <div className="mb-4 flex justify-end">
            <span className="text-[14px] font-medium text-fg">{planName}</span>
          </div>
          {overLimitMessage ? (
            <p
              className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200"
              role="alert"
            >
              {overLimitMessage}
            </p>
          ) : null}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

function getTeamOverLimitMessage(usage: UsageData): string | undefined {
  const overBy = usage.team.domainsUsed - usage.team.domainsLimit;
  if (overBy <= 0) return undefined;

  return `You are ${formatNumber(overBy)} ${pluralize(
    overBy,
    "domain",
  )} over the ${usage.plan.name} plan domain limit.`;
}

export function UsageTab({
  usage,
  billingEnabled = false,
}: {
  usage: UsageData;
  billingEnabled?: boolean;
}) {
  const planName = usage.plan.name;

  return (
    <div>
      <QuotaSection
        title="Transactional"
        description="Integrate email into your app using the Resend API or SMTP interface."
        planName={planName}
        billingEnabled={billingEnabled}
      >
        <QuotaRow
          label="Monthly limit"
          value={`${formatNumber(usage.transactional.monthlyUsed)} / ${formatNumber(usage.transactional.monthlyLimit)}`}
          used={usage.transactional.monthlyUsed}
          limit={usage.transactional.monthlyLimit}
        />
        <QuotaRow
          label="Daily limit"
          value={`${formatNumber(usage.transactional.dailyUsed)} / ${formatNumber(usage.transactional.dailyLimit)}`}
          used={usage.transactional.dailyUsed}
          limit={usage.transactional.dailyLimit}
        />
      </QuotaSection>

      <QuotaSection
        title="Marketing"
        description="Design and send marketing emails using Broadcasts and Audiences."
        planName={planName}
        billingEnabled={billingEnabled}
      >
        <QuotaRow
          label="Contacts limit"
          value={`${formatNumber(usage.marketing.contactsUsed)} / ${formatNumber(usage.marketing.contactsLimit)}`}
          used={usage.marketing.contactsUsed}
          limit={usage.marketing.contactsLimit}
        />
        <QuotaRow
          label="Segments limit"
          value={`${formatNumber(usage.marketing.segmentsUsed)} / ${formatNumber(usage.marketing.segmentsLimit)}`}
          used={usage.marketing.segmentsUsed}
          limit={usage.marketing.segmentsLimit}
        />
        <QuotaRow label="Broadcasts limit" value="Unlimited" />
      </QuotaSection>

      <QuotaSection
        title="Team"
        description="Manage your team settings, domains, and sending rate limits."
        planName={planName}
        billingEnabled={billingEnabled}
        overLimitMessage={getTeamOverLimitMessage(usage)}
      >
        <QuotaRow
          label="Domains limit"
          value={`${formatNumber(usage.team.domainsUsed)} / ${formatNumber(usage.team.domainsLimit)}`}
          used={usage.team.domainsUsed}
          limit={usage.team.domainsLimit}
        />
        <QuotaRow label="Rate limit" value={`${usage.team.rateLimit} / sec`} />
      </QuotaSection>
    </div>
  );
}
