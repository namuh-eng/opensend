import {
  type RenderedTemplate,
  type TemplateRenderVariables,
  renderTemplate,
} from "@opensend/core";

export type StoredTemplateRendererConfig =
  | { kind: "legacy" }
  | { kind: "react_email"; templateKey: string };

export type StoredTemplateRendererConfigErrorCode =
  | "react_template_key_missing"
  | "unsupported_template_renderer";

export class StoredTemplateRendererConfigError extends Error {
  constructor(
    readonly code: StoredTemplateRendererConfigErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StoredTemplateRendererConfigError";
  }
}

type StoredTemplateContent = {
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  document?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readConfigCandidate(
  candidate: Record<string, unknown>,
): StoredTemplateRendererConfig | null {
  if (candidate.kind === "legacy") {
    return { kind: "legacy" };
  }

  if (candidate.kind === "react_email") {
    if (typeof candidate.templateKey !== "string") {
      throw new StoredTemplateRendererConfigError(
        "react_template_key_missing",
        "React Email template key is missing.",
      );
    }

    const templateKey = candidate.templateKey.trim();
    if (!templateKey) {
      throw new StoredTemplateRendererConfigError(
        "react_template_key_missing",
        "React Email template key is missing.",
      );
    }

    return { kind: "react_email", templateKey };
  }

  if (candidate.kind !== undefined) {
    throw new StoredTemplateRendererConfigError(
      "unsupported_template_renderer",
      `Unsupported template renderer kind: ${String(candidate.kind)}.`,
    );
  }

  return null;
}

export function getStoredTemplateRendererConfig(
  document: unknown,
): StoredTemplateRendererConfig {
  if (!isRecord(document)) {
    return { kind: "legacy" };
  }

  const nestedRendering = document.rendering;
  if (isRecord(nestedRendering)) {
    const nestedConfig = readConfigCandidate(nestedRendering);
    if (nestedConfig) return nestedConfig;
  }

  const nestedRenderer = document.renderer;
  if (isRecord(nestedRenderer)) {
    const nestedConfig = readConfigCandidate(nestedRenderer);
    if (nestedConfig) return nestedConfig;
  }

  if (document.kind === "react_email" || document.kind === "legacy") {
    const topLevelConfig = readConfigCandidate(document);
    if (topLevelConfig) return topLevelConfig;
  }

  return { kind: "legacy" };
}

export async function renderStoredTemplateContent(input: {
  template: StoredTemplateContent;
  subject?: string | null;
  variables?: TemplateRenderVariables;
}): Promise<RenderedTemplate> {
  const config = getStoredTemplateRendererConfig(input.template.document);
  const variables = input.variables ?? {};

  if (config.kind === "react_email") {
    const rendered = await renderTemplate({
      kind: "react_email",
      templateKey: config.templateKey,
      variables,
    });
    if (input.subject !== undefined && input.subject !== null) {
      const subjectOverride = await renderTemplate({
        subject: input.subject,
        html: "",
        text: "",
        variables,
      });
      return { ...rendered, subject: subjectOverride.subject };
    }
    return rendered;
  }

  return await renderTemplate({
    subject: input.subject ?? input.template.subject ?? "",
    html: input.template.html,
    text: input.template.text,
    variables,
  });
}
