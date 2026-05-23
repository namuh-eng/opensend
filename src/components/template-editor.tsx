"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type TemplateApiResponse = {
  id: string;
  name: string;
  alias: string | null;
  status: string;
  subject: string | null;
  from: string | null;
  reply_to: string | null;
  preview_text: string | null;
  html: string | null;
  text: string | null;
  variables: unknown[] | null;
  created_at: string;
  updated_at: string;
};

type TemplateFormState = {
  name: string;
  alias: string;
  from: string;
  replyTo: string;
  subject: string;
  previewText: string;
  html: string;
  text: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type LoadState = "loading" | "ready" | "error";

type TemplateEditorProps = {
  templateId: string;
};

const EMPTY_FORM: TemplateFormState = {
  name: "",
  alias: "",
  from: "",
  replyTo: "",
  subject: "",
  previewText: "",
  html: "",
  text: "",
};

function formFromTemplate(template: TemplateApiResponse): TemplateFormState {
  return {
    name: template.name,
    alias: template.alias ?? "",
    from: template.from ?? "",
    replyTo: template.reply_to ?? "",
    subject: template.subject ?? "",
    previewText: template.preview_text ?? "",
    html: template.html ?? "",
    text: template.text ?? "",
  };
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey =
    typeof window !== "undefined"
      ? (window.localStorage?.getItem?.("api_key") ?? null)
      : null;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  return fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isDirty(
  current: TemplateFormState,
  persisted: TemplateFormState | null,
): boolean {
  if (!persisted) return false;
  return Object.keys(current).some((key) => {
    const formKey = key as keyof TemplateFormState;
    return current[formKey] !== persisted[formKey];
  });
}

function textOrPlaceholder(value: string, placeholder: string): string {
  return value.trim() ? value : placeholder;
}

export function TemplateEditor({ templateId }: TemplateEditorProps) {
  const [template, setTemplate] = useState<TemplateApiResponse | null>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [persistedForm, setPersistedForm] = useState<TemplateFormState | null>(
    null,
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const dirty = useMemo(
    () => isDirty(form, persistedForm),
    [form, persistedForm],
  );
  const canSave = form.name.trim().length > 0 && form.html.trim().length > 0;
  const isDraft = template?.status !== "published";

  const loadTemplate = useCallback(async () => {
    setLoadState("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        headers: apiHeaders(),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Could not load template."));
      }
      const payload = (await response.json()) as TemplateApiResponse;
      const nextForm = formFromTemplate(payload);
      setTemplate(payload);
      setForm(nextForm);
      setPersistedForm(nextForm);
      setLoadState("ready");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load template.",
      );
      setLoadState("error");
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  function updateField<K extends keyof TemplateFormState>(
    field: K,
    value: TemplateFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    if (saveState === "saved") setSaveState("idle");
  }

  async function saveTemplate(): Promise<boolean> {
    if (!canSave) {
      setSaveState("error");
      setMessage("Template name and HTML are required.");
      return false;
    }

    setSaveState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: {
          ...apiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name.trim(),
          alias: form.alias.trim() || null,
          from: form.from.trim() || null,
          reply_to: form.replyTo.trim() || null,
          subject: form.subject,
          preview_text: form.previewText,
          html: form.html,
          text: form.text,
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Could not save template."));
      }

      const payload = (await response.json()) as TemplateApiResponse;
      const nextForm = formFromTemplate(payload);
      setTemplate(payload);
      setForm(nextForm);
      setPersistedForm(nextForm);
      setPreviewKey((key) => key + 1);
      setSaveState("saved");
      setMessage("Template saved.");
      return true;
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error ? error.message : "Could not save template.",
      );
      return false;
    }
  }

  async function publishTemplate() {
    setSaveState("saving");
    setMessage(null);
    try {
      if (dirty) {
        const saved = await saveTemplate();
        if (!saved) return;
      }
      const response = await fetch(`/api/templates/${templateId}/publish`, {
        method: "POST",
        headers: apiHeaders(),
      });
      if (!response.ok) {
        throw new Error(
          await readError(response, "Could not publish template."),
        );
      }
      const payload = (await response.json()) as {
        status?: string;
        published_at?: string | null;
        has_unpublished_versions?: boolean;
      };
      setTemplate((current) =>
        current
          ? {
              ...current,
              status: payload.status ?? "published",
              updated_at: new Date().toISOString(),
            }
          : current,
      );
      setSaveState("saved");
      setMessage("Template published.");
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error ? error.message : "Could not publish template.",
      );
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[480px] items-center justify-center text-sm text-fg-2">
        Loading template editor...
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {message ?? "Could not load template."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-fg-3">
              <Link href="/templates" className="hover:text-fg">
                Templates
              </Link>
              <span>/</span>
              <span className="truncate">
                {textOrPlaceholder(form.name, "Untitled Template")}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${isDraft ? "bg-yellow-900/30 text-yellow-300" : "bg-green-900/30 text-green-300"}`}
              >
                {isDraft ? "Draft" : "Published"}
              </span>
              {dirty ? <span className="text-yellow-300">Unsaved</span> : null}
            </div>
            <h1 className="mt-1 truncate text-lg font-semibold">
              Template editor
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/templates/${templateId}`}
              className="rounded-md border border-line px-3 py-2 text-sm text-fg-2 transition-colors hover:border-line-3 hover:text-fg"
            >
              View details
            </Link>
            <button
              type="button"
              onClick={saveTemplate}
              disabled={saveState === "saving" || !canSave}
              className="rounded-md border border-line px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-line-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveState === "saving" ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={publishTemplate}
              disabled={saveState === "saving" || !canSave || !isDraft}
              className="rounded-md bg-fg px-3 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDraft ? "Publish" : "Published"}
            </button>
          </div>
        </div>
      </header>

      <main className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-5 rounded-xl border border-line bg-bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-fg-2">Template name</span>
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none focus:border-line-3"
                aria-label="Template name"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-fg-2">Alias</span>
              <input
                value={form.alias}
                onChange={(event) => updateField("alias", event.target.value)}
                className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none focus:border-line-3"
                aria-label="Alias"
                placeholder="welcome-email"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-fg-2">From</span>
              <input
                value={form.from}
                onChange={(event) => updateField("from", event.target.value)}
                className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none focus:border-line-3"
                aria-label="From"
                placeholder="Acme <hello@example.com>"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-fg-2">Reply-To</span>
              <input
                value={form.replyTo}
                onChange={(event) => updateField("replyTo", event.target.value)}
                className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none focus:border-line-3"
                aria-label="Reply-To"
                placeholder="support@example.com"
              />
            </label>
          </div>

          <label className="space-y-1.5 text-sm">
            <span className="text-fg-2">Subject</span>
            <input
              value={form.subject}
              onChange={(event) => updateField("subject", event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none focus:border-line-3"
              aria-label="Subject"
              placeholder="Welcome, {{name}}"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-fg-2">Preview text</span>
            <input
              value={form.previewText}
              onChange={(event) =>
                updateField("previewText", event.target.value)
              }
              className="h-10 w-full rounded-md border border-line bg-transparent px-3 text-sm outline-none focus:border-line-3"
              aria-label="Preview text"
              placeholder="A short inbox preview"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-fg-2">HTML</span>
            <textarea
              value={form.html}
              onChange={(event) => updateField("html", event.target.value)}
              className="min-h-[360px] w-full resize-y rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-line-3"
              aria-label="HTML"
              spellCheck={false}
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-fg-2">Text/plain fallback</span>
            <textarea
              value={form.text}
              onChange={(event) => updateField("text", event.target.value)}
              className="min-h-[140px] w-full resize-y rounded-md border border-line bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-line-3"
              aria-label="Text/plain fallback"
              spellCheck={false}
            />
          </label>
        </section>

        <aside className="space-y-5">
          {message ? (
            <output
              aria-live="polite"
              className={`block rounded-lg border p-3 text-sm ${saveState === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-line bg-bg-card text-fg-2"}`}
            >
              {message}
            </output>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-line bg-bg-card">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-medium">Live HTML preview</h2>
                <p className="mt-1 text-xs text-fg-3">
                  Updates as you type. Save to refresh production rendering.
                </p>
              </div>
            </div>
            <div className="bg-white p-3">
              {form.html.trim() ? (
                <iframe
                  key={previewKey}
                  srcDoc={form.html}
                  title="Template editor live preview"
                  sandbox="allow-same-origin"
                  className="h-[420px] w-full rounded-md border border-gray-200 bg-white"
                />
              ) : (
                <div className="flex h-[420px] items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500">
                  Add HTML to preview this template.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-bg-card p-4 text-sm text-fg-2">
            <h2 className="text-sm font-medium text-fg">Template metadata</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3">
                <dt>Status</dt>
                <dd className="text-fg">{template?.status ?? "draft"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Created</dt>
                <dd className="text-right text-fg">
                  {template ? formatDate(template.created_at) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Updated</dt>
                <dd className="text-right text-fg">
                  {template ? formatDate(template.updated_at) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Variables</dt>
                <dd className="text-fg">{template?.variables?.length ?? 0}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </main>
    </div>
  );
}
