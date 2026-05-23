"use client";

import { useEffect, useRef, useState } from "react";

type Settings = {
  logoUrl: string;
  brandColor: string;
  headline: string;
  message: string;
  footerText: string;
};

const DEFAULTS: Settings = {
  logoUrl: "",
  brandColor: "#10b981",
  headline: "Unsubscribed successfully",
  message:
    "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
  footerText: "Powered by OpenSend",
};

function previewHtml(s: Settings): string {
  const color = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s.brandColor)
    ? s.brandColor
    : "#10b981";
  const logoTag =
    s.logoUrl && /^https?:\/\//.test(s.logoUrl)
      ? `<img src="${s.logoUrl.replace(/"/g, "%22")}" alt="Logo" style="max-height:48px;max-width:180px;margin:0 auto 1rem;display:block;" />`
      : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${s.headline} · OpenSend</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0a; color: #fff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(28rem, calc(100vw - 3rem)); background: #1a1a1a; border: 1px solid rgba(255,255,255,.08); border-radius: 1rem; padding: 2rem; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
    .icon { width: 3rem; height: 3rem; border-radius: 999px; margin: 0 auto 1rem; display: grid; place-items: center; color: ${color}; border: 2px solid ${color}; font-weight: 700; }
    h1 { margin: 0 0 1rem; font-size: 1.25rem; }
    p { color: #a1a1aa; line-height: 1.5; margin: 0; font-size: .875rem; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,.04); color: #52525b; font-size: .625rem; text-transform: uppercase; letter-spacing: .16em; font-weight: 600; }
  </style>
</head>
<body>
  <main data-testid="unsubscribe-success">
    ${logoTag}
    <div class="icon" aria-hidden="true">✓</div>
    <h1>${s.headline}</h1>
    <p>${s.message}</p>
    <footer>${s.footerText}</footer>
  </main>
</body>
</html>`;
}

export function UnsubscribePageEditor() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
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
        const data = await res.json();
        if (!cancelled) {
          setSettings({
            logoUrl: data.logo_url ?? "",
            brandColor: data.brand_color ?? DEFAULTS.brandColor,
            headline: data.headline ?? DEFAULTS.headline,
            message: data.message ?? DEFAULTS.message,
            footerText: data.footer_text ?? DEFAULTS.footerText,
          });
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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Form panel */}
      <div className="w-full max-w-sm space-y-5 flex-shrink-0">
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
              className="flex-1 h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 font-mono"
            />
          </div>
        </div>

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
            rows={4}
            className="w-full px-3 py-2 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 resize-y"
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

        {error && (
          <p className="text-[13px] text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
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

      {/* Live preview */}
      <div className="flex-1 min-w-0">
        <p className="mb-2 text-[12px] font-medium text-fg-2 uppercase tracking-wider">
          Live preview
        </p>
        <div className="w-full overflow-hidden rounded-lg border border-line">
          <iframe
            title="Unsubscribe page preview"
            srcDoc={previewHtml(settings)}
            className="h-[480px] w-full"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
