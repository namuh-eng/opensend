"use client";

import {
  UnsubscribePagePreview,
  type UnsubscribePreviewTopic,
} from "@/components/unsubscribe-page-preview";
import { ListChecks, PenLine } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type Settings = {
  logoUrl: string;
  brandColor: string;
  headline: string;
  message: string;
  footerText: string;
};

type TopicApiPayload = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  default_subscription?: unknown;
  defaultSubscription?: unknown;
  visibility?: unknown;
};

type SettingsApiPayload = {
  logo_url?: unknown;
  brand_color?: unknown;
  headline?: unknown;
  message?: unknown;
  footer_text?: unknown;
  topics?: unknown;
};

const DEFAULTS: Settings = {
  logoUrl: "",
  brandColor: "#10b981",
  headline: "Unsubscribed successfully",
  message:
    "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
  footerText: "Powered by OpenSend",
};

function safeBrandColor(value: string): string {
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)
    ? value
    : DEFAULTS.brandColor;
}

function normalizeTopic(topic: TopicApiPayload): UnsubscribePreviewTopic {
  return {
    id: String(topic.id ?? ""),
    name: String(topic.name ?? ""),
    description:
      typeof topic.description === "string" ? topic.description : null,
    defaultSubscription:
      topic.default_subscription === "opt_in" ||
      topic.defaultSubscription === "opt_in"
        ? "opt_in"
        : "opt_out",
    visibility:
      topic.visibility === "private" || topic.visibility === "public"
        ? topic.visibility
        : "private",
  };
}

function isTopicApiPayload(value: unknown): value is TopicApiPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSettingsApiPayload(value: unknown): value is SettingsApiPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTopics(value: unknown): UnsubscribePreviewTopic[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isTopicApiPayload).map(normalizeTopic);
}

export function UnsubscribePageEditor() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [topics, setTopics] = useState<UnsubscribePreviewTopic[]>([]);
  const [previewMode, setPreviewMode] = useState<"preferences" | "success">(
    "preferences",
  );
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/unsubscribe-page");
        if (!res.ok) throw new Error("Failed to load settings");
        const data: unknown = await res.json();
        if (!isSettingsApiPayload(data)) {
          throw new Error("Invalid settings payload");
        }
        if (!cancelled) {
          setSettings({
            logoUrl: typeof data.logo_url === "string" ? data.logo_url : "",
            brandColor:
              typeof data.brand_color === "string"
                ? data.brand_color
                : DEFAULTS.brandColor,
            headline:
              typeof data.headline === "string"
                ? data.headline
                : DEFAULTS.headline,
            message:
              typeof data.message === "string"
                ? data.message
                : DEFAULTS.message,
            footerText:
              typeof data.footer_text === "string"
                ? data.footer_text
                : DEFAULTS.footerText,
          });
          setTopics(normalizeTopics(data.topics));
        }
      } catch {
        if (!cancelled) setError("Could not load settings. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (field: keyof Settings) => (value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };
  const tabStyle = (active: boolean): CSSProperties => ({
    backgroundColor: active ? "var(--accent-soft)" : "transparent",
    borderColor: active ? "rgba(196, 255, 90, 0.5)" : "transparent",
    color: active ? "var(--accent)" : "var(--fg-3)",
  });
  const brandColor = safeBrandColor(settings.brandColor);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/unsubscribe-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: settings.logoUrl || null,
          brand_color: settings.brandColor,
          headline: settings.headline,
          message: settings.message,
          footer_text: settings.footerText,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Save failed");
        return;
      }
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="inline-flex rounded-lg border border-line bg-bg p-1">
          <button
            type="button"
            onClick={() => setPreviewMode("preferences")}
            aria-pressed={previewMode === "preferences"}
            className="rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors hover:text-fg"
            style={tabStyle(previewMode === "preferences")}
          >
            Preferences
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode("success")}
            aria-pressed={previewMode === "success"}
            className="rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors hover:text-fg"
            style={tabStyle(previewMode === "success")}
          >
            Success
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditor((value) => !value)}
            aria-expanded={showEditor}
            className="btn btn-ghost btn-sm"
          >
            <PenLine
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.8}
            />
            Edit
          </button>
          <Link href="/audience/topics" className="btn btn-ghost btn-sm">
            <ListChecks
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.8}
            />
            Topics
          </Link>
        </div>
      </div>

      {showEditor && (
        <div className="border-b border-line bg-bg-2 p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <label
                htmlFor="logo-url"
                className="block text-[13px] font-medium text-fg-2 mb-1.5"
              >
                Logo URL
              </label>
              <input
                id="logo-url"
                type="url"
                value={settings.logoUrl}
                onChange={(e) => update("logoUrl")(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
              />
              <p className="mt-1 text-[11px] text-fg-3">
                Leave blank to hide the logo.
              </p>
            </div>

            <div>
              <label
                htmlFor="brand-color"
                className="block text-[13px] font-medium text-fg-2 mb-1.5"
              >
                Brand color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="brand-color-picker"
                  type="color"
                  value={settings.brandColor.slice(0, 7)}
                  onChange={(e) => update("brandColor")(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border border-line bg-transparent p-1"
                  aria-label="Brand color picker"
                />
                <input
                  id="brand-color"
                  type="text"
                  value={settings.brandColor}
                  onChange={(e) => update("brandColor")(e.target.value)}
                  maxLength={9}
                  placeholder="#10b981"
                  className="min-w-0 flex-1 h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <label
                htmlFor="headline"
                className="block text-[13px] font-medium text-fg-2 mb-1.5"
              >
                Headline
              </label>
              <input
                id="headline"
                type="text"
                value={settings.headline}
                onChange={(e) => update("headline")(e.target.value)}
                maxLength={200}
                className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
              />
            </div>

            <div>
              <label
                htmlFor="footer-text"
                className="block text-[13px] font-medium text-fg-2 mb-1.5"
              >
                Footer text
              </label>
              <input
                id="footer-text"
                type="text"
                value={settings.footerText}
                onChange={(e) => update("footerText")(e.target.value)}
                maxLength={200}
                className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="message"
              className="block text-[13px] font-medium text-fg-2 mb-1.5"
            >
              Message
            </label>
            <textarea
              id="message"
              value={settings.message}
              onChange={(e) => update("message")(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 resize-y"
            />
          </div>

          {error && (
            <p className="mt-4 text-[13px] text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-[13px] text-green-400">Saved</span>}
          </div>
        </div>
      )}

      <div className="p-5">
        <UnsubscribePagePreview
          mode={previewMode}
          topics={topics}
          size="wide"
          settings={{ ...settings, brandColor }}
        />
      </div>
    </div>
  );
}
