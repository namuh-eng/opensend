"use client";

import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { DocumentsTab } from "@/components/settings-documents";
import { TeamTab } from "@/components/settings-team";
import { type UsageData, UsageTab } from "@/components/settings-usage";
import Link from "next/link";
import { useEffect, useState } from "react";

function isUsageData(value: unknown): value is UsageData {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<UsageData> & Record<string, unknown>;

  return (
    typeof candidate.transactional === "object" &&
    candidate.transactional !== null &&
    typeof candidate.transactional.monthlyUsed === "number" &&
    typeof candidate.transactional.monthlyLimit === "number" &&
    typeof candidate.transactional.dailyUsed === "number" &&
    typeof candidate.transactional.dailyLimit === "number" &&
    typeof candidate.marketing === "object" &&
    candidate.marketing !== null &&
    typeof candidate.marketing.contactsUsed === "number" &&
    typeof candidate.marketing.contactsLimit === "number" &&
    typeof candidate.marketing.segmentsUsed === "number" &&
    typeof candidate.marketing.segmentsLimit === "number" &&
    candidate.marketing.broadcastsLimit === "Unlimited" &&
    typeof candidate.team === "object" &&
    candidate.team !== null &&
    typeof candidate.team.domainsUsed === "number" &&
    typeof candidate.team.domainsLimit === "number" &&
    typeof candidate.team.rateLimit === "number"
  );
}

const SMTP_CREDENTIALS = [
  { label: "Host", value: "smtp.opensend.com" },
  { label: "Port", value: "465" },
  { label: "Username", value: "resend" },
  { label: "Password", value: "YOUR_API_KEY" },
];

const DEFAULT_USAGE: UsageData = {
  transactional: {
    monthlyUsed: 0,
    monthlyLimit: 3000,
    dailyUsed: 0,
    dailyLimit: 100,
  },
  marketing: {
    contactsUsed: 0,
    contactsLimit: 1000,
    segmentsUsed: 0,
    segmentsLimit: 3,
    broadcastsLimit: "Unlimited",
  },
  team: { domainsUsed: 0, domainsLimit: 3, rateLimit: 2 },
};

interface SettingsPageProps {
  billingEnabled?: boolean;
}

export function SettingsPage({
  billingEnabled = false,
}: SettingsPageProps = {}) {
  const [activeTab, setActiveTab] = useState<
    "usage" | "smtp" | "team" | "unsubscribe" | "billing" | "documents"
  >("usage");
  const [usage, setUsage] = useState<UsageData>(DEFAULT_USAGE);

  useEffect(() => {
    if (activeTab !== "usage") return;

    fetch("/api/usage")
      .then(async (response) => {
        if (!response.ok) return null;

        const data: unknown = await response.json();
        return isUsageData(data) ? data : null;
      })
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});
  }, [activeTab]);

  const tabs = [
    { key: "usage", label: "Usage" },
    { key: "smtp", label: "SMTP" },
    { key: "team", label: "Team" },
    { key: "unsubscribe", label: "Unsubscribe Page" },
    ...(billingEnabled ? [{ key: "billing", label: "Billing" } as const] : []),
    { key: "documents", label: "Documents" },
  ] as const;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#F0F0F0] mb-6">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-[rgba(176,199,217,0.145)] mb-6 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#F0F0F0] text-[#F0F0F0]"
                  : "border-transparent text-[#A1A4A5] hover:text-[#F0F0F0]"
              }`}
              onClick={() => setActiveTab(tab.key)}
              data-state={activeTab === tab.key ? "active" : "inactive"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Tab */}
      {activeTab === "usage" && <UsageTab usage={usage} />}

      {/* SMTP Tab */}
      {activeTab === "smtp" && (
        <div>
          <p className="text-[14px] text-[#A1A4A5] mb-6">
            Use these credentials to send emails via SMTP. The password is your
            API key.
          </p>

          <div className="border border-[rgba(176,199,217,0.145)] rounded-lg overflow-hidden">
            {SMTP_CREDENTIALS.map((cred, i) => (
              <div
                key={cred.label}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < SMTP_CREDENTIALS.length - 1
                    ? "border-b border-[rgba(176,199,217,0.145)]"
                    : ""
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-[12px] font-medium text-[#A1A4A5] tracking-wider w-24 shrink-0">
                    {cred.label.toUpperCase()}
                  </span>
                  <span className="text-[14px] text-[#F0F0F0] font-mono truncate">
                    {cred.value}
                  </span>
                </div>
                <CopyToClipboard value={cred.value} />
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-lg">
            <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-2">
              EXAMPLE CONFIGURATION
            </p>
            <pre className="text-[13px] text-[#F0F0F0] font-mono whitespace-pre-wrap">
              {`SMTP_HOST=smtp.opensend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_YOUR_API_KEY`}
            </pre>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && <TeamTab />}

      {/* Billing Tab → dedicated page */}
      {activeTab === "billing" && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-[rgba(176,199,217,0.145)] p-8">
          <p className="text-[14px] text-[#A1A4A5]">
            Billing has its own dedicated page with current plan, usage, and
            management actions.
          </p>
          <Link
            href="/settings/billing"
            className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] font-medium text-[#F0F0F0] hover:bg-[rgba(24,25,28,1)]"
          >
            Open billing
          </Link>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && <DocumentsTab />}

      {/* Unsubscribe Tab */}
      {activeTab === "unsubscribe" && (
        <div>
          <p className="text-[14px] text-[#A1A4A5] mb-6">
            Preview the unsubscribe page shown to recipients when they click the
            unsubscribe link.
          </p>

          <div className="border border-[rgba(176,199,217,0.145)] rounded-lg overflow-hidden bg-white">
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
              <div className="max-w-md w-full text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Unsubscribe
                </h2>
                <p className="text-gray-600 text-sm mb-6">
                  You have been unsubscribed from this mailing list. You will no
                  longer receive emails from this sender.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-md">
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  Successfully unsubscribed
                </div>
                <p className="text-gray-400 text-xs mt-6">
                  Powered by Opensend
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
