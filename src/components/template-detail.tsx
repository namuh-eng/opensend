"use client";

import { useEffect, useState } from "react";

type TemplateVariable = {
  name: string;
  key?: string;
  required: boolean;
  type?: "string" | "number";
  fallback_value?: string | number | null;
};

type PreviewVariableSource =
  | "provided"
  | "fallback"
  | "preview_sample"
  | "missing_optional"
  | "missing_required";

type PreviewVariable = {
  key: string;
  name: string;
  type: "string" | "number";
  required: boolean;
  fallbackValue: string | number | null;
  value: string | number | null;
  source: PreviewVariableSource;
  sendRequired: boolean;
};

type TemplatePreview = {
  subject: string;
  html: string;
  text: string;
  rendering: {
    kind: "legacy" | "react_email";
    template_key: string | null;
  };
  variables: PreviewVariable[];
  warnings: string[];
};

interface TemplateDetailProps {
  template: {
    id: string;
    name: string;
    alias: string | null;
    from: string | null;
    subject: string | null;
    html: string | null;
    text: string | null;
    published: boolean;
    variables: TemplateVariable[];
    createdAt: string;
    updatedAt: string;
  };
}

function previewSourceLabel(source: PreviewVariableSource): string {
  switch (source) {
    case "provided":
      return "Provided";
    case "fallback":
      return "Fallback";
    case "preview_sample":
      return "Preview sample";
    case "missing_optional":
      return "Not supplied";
    case "missing_required":
      return "Missing required";
  }
}

function valueLabel(value: string | number | null): string {
  return value === null ? "—" : String(value);
}

export function TemplateDetail({ template }: TemplateDetailProps) {
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchPreview() {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const apiKey =
          typeof window !== "undefined"
            ? (localStorage?.getItem?.("api_key") ?? null)
            : null;
        const headers: Record<string, string> = {};
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        const res = await fetch(`/api/templates/${template.id}/preview`, {
          headers,
        });
        const payload: unknown = await res.json().catch(() => null);
        if (!active) return;

        if (!res.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : "Could not render preview.";
          setPreviewError(message);
          setPreview(null);
          return;
        }

        setPreview(payload as TemplatePreview);
      } catch {
        if (active) {
          setPreviewError("Could not render preview.");
          setPreview(null);
        }
      } finally {
        if (active) setPreviewLoading(false);
      }
    }

    fetchPreview();

    return () => {
      active = false;
    };
  }, [template.id]);

  const htmlPreview = preview?.html || template.html || "";
  const textPreview = preview?.text || template.text || "";
  const subjectPreview = preview?.subject || template.subject;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{template.name}</h1>
          {preview?.rendering.kind === "react_email" ? (
            <p className="mt-1 text-sm text-fg-2">
              React Email registry template: {preview.rendering.template_key}
            </p>
          ) : null}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            template.published
              ? "bg-green-900/30 text-green-400"
              : "bg-yellow-900/30 text-yellow-400"
          }`}
        >
          {template.published ? "Published" : "Draft"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-fg-2">
        {template.alias && (
          <div>
            <span className="text-fg-3">Alias:</span> {template.alias}
          </div>
        )}
        {template.from && (
          <div>
            <span className="text-fg-3">From:</span> {template.from}
          </div>
        )}
        {subjectPreview && (
          <div>
            <span className="text-fg-3">Subject:</span> {subjectPreview}
          </div>
        )}
        <div>
          <span className="text-fg-3">Created:</span>{" "}
          {new Date(template.createdAt).toLocaleDateString()}
        </div>
        <div>
          <span className="text-fg-3">Updated:</span>{" "}
          {new Date(template.updatedAt).toLocaleDateString()}
        </div>
      </div>

      <section className="rounded-lg border border-line bg-bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-fg">
              Production renderer preview
            </h2>
            <p className="mt-1 text-xs text-fg-2">
              Rendered through the same stored-template renderer used by send
              and automation flows. Preview sample values are labeled and are
              not sent automatically.
            </p>
          </div>
          <span className="rounded-full bg-bg-2 px-2 py-1 text-xs text-fg-2">
            {previewLoading ? "Rendering..." : "Rendered"}
          </span>
        </div>
        {previewError ? (
          <div
            role="alert"
            className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
          >
            {previewError}
          </div>
        ) : null}
        {preview?.warnings.length ? (
          <ul className="mt-3 space-y-1 text-xs text-yellow-300">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {preview?.variables.length || template.variables.length ? (
        <div>
          <h3 className="text-sm font-medium text-fg-2 mb-2">
            Variable resolution
          </h3>
          {preview?.variables.length ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left text-xs text-fg-2">
                <thead className="bg-bg-2 text-fg">
                  <tr>
                    <th className="px-3 py-2 font-medium">Variable</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Send requirement</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.variables.map((variable) => (
                    <tr key={variable.key} className="border-t border-line">
                      <td className="px-3 py-2 font-mono text-fg">
                        {`{{${variable.key}}}`}
                      </td>
                      <td className="px-3 py-2">
                        {valueLabel(variable.value)}
                      </td>
                      <td className="px-3 py-2">
                        {previewSourceLabel(variable.source)}
                      </td>
                      <td className="px-3 py-2">
                        {variable.sendRequired
                          ? "Required before send"
                          : variable.required
                            ? "Required with fallback"
                            : "Optional"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {template.variables.map((variable) => (
                <span
                  key={variable.key ?? variable.name}
                  className="text-xs px-2 py-1 rounded bg-bg-2 text-fg-2 border border-line"
                >
                  {`{{${variable.key ?? variable.name}}}`}
                  {variable.required && (
                    <span className="text-red-400 ml-1">*</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {htmlPreview ? (
        <div data-testid="template-html-preview">
          <h3 className="text-sm font-medium text-fg-2 mb-2">HTML Preview</h3>
          <div className="border border-line rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={htmlPreview}
              className="w-full min-h-[520px]"
              title="Template Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      ) : null}

      {textPreview ? (
        <div data-testid="template-text-preview">
          <h3 className="text-sm font-medium text-fg-2 mb-2">
            Text/plain Preview
          </h3>
          <pre className="text-sm text-fg-2 bg-bg-2 p-4 rounded-lg whitespace-pre-wrap">
            {textPreview}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
