import {
  type RenderedTemplate,
  type TemplateRenderVariables,
  renderTemplate,
} from "@opensend/core";
import { normalizeStoredTemplateVariables } from "./variables";

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
  variables?: unknown;
};

export type StoredTemplateRenderVariableSource =
  | "provided"
  | "fallback"
  | "preview_sample"
  | "missing_optional"
  | "missing_required";

export type StoredTemplateRenderVariableResolution = {
  key: string;
  name: string;
  type: "string" | "number";
  required: boolean;
  fallbackValue: string | number | null;
  value: string | number | null;
  source: StoredTemplateRenderVariableSource;
  sendRequired: boolean;
};

export type StoredTemplateRenderVariableResult =
  | {
      ok: true;
      variables: TemplateRenderVariables;
      resolutions: StoredTemplateRenderVariableResolution[];
      warnings: string[];
    }
  | {
      ok: false;
      missingRequiredKey: string;
      variables: TemplateRenderVariables;
      resolutions: StoredTemplateRenderVariableResolution[];
      warnings: string[];
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

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function previewSampleValue(input: {
  key: string;
  name: string;
  type: "string" | "number";
}): string | number {
  if (input.type === "number") return 42;
  const readableName = input.name || input.key;
  return `Sample ${readableName}`;
}

export function resolveStoredTemplateRenderVariables(input: {
  storedVariables: unknown;
  providedVariables?: TemplateRenderVariables;
  mode: "send" | "preview";
}): StoredTemplateRenderVariableResult {
  const providedVars = input.providedVariables ?? {};
  const renderVars: TemplateRenderVariables = { ...providedVars };
  const templateVars = normalizeStoredTemplateVariables(input.storedVariables);
  const resolutions: StoredTemplateRenderVariableResolution[] = [];
  const warnings: string[] = [];
  let missingRequiredKey: string | null = null;

  for (const templateVar of templateVars) {
    if (hasOwn(providedVars, templateVar.key)) {
      const value = providedVars[templateVar.key];
      resolutions.push({
        key: templateVar.key,
        name: templateVar.name,
        type: templateVar.type,
        required: templateVar.required,
        fallbackValue: templateVar.fallbackValue,
        value:
          typeof value === "string" || typeof value === "number"
            ? value
            : value === null || value === undefined
              ? null
              : String(value),
        source: "provided",
        sendRequired: false,
      });
      continue;
    }

    if (templateVar.hasFallbackValue) {
      renderVars[templateVar.key] = templateVar.fallbackValue;
      warnings.push(`Using fallback for ${templateVar.key}.`);
      resolutions.push({
        key: templateVar.key,
        name: templateVar.name,
        type: templateVar.type,
        required: templateVar.required,
        fallbackValue: templateVar.fallbackValue,
        value: templateVar.fallbackValue,
        source: "fallback",
        sendRequired: false,
      });
      continue;
    }

    if (templateVar.required) {
      if (input.mode === "preview") {
        const value = previewSampleValue(templateVar);
        renderVars[templateVar.key] = value;
        warnings.push(
          `Preview uses a sample value for required variable ${templateVar.key}; production sends must provide it.`,
        );
        resolutions.push({
          key: templateVar.key,
          name: templateVar.name,
          type: templateVar.type,
          required: true,
          fallbackValue: null,
          value,
          source: "preview_sample",
          sendRequired: true,
        });
        continue;
      }

      missingRequiredKey ??= templateVar.key;
      warnings.push(`Missing required variable ${templateVar.key}.`);
      resolutions.push({
        key: templateVar.key,
        name: templateVar.name,
        type: templateVar.type,
        required: true,
        fallbackValue: null,
        value: null,
        source: "missing_required",
        sendRequired: true,
      });
      continue;
    }

    resolutions.push({
      key: templateVar.key,
      name: templateVar.name,
      type: templateVar.type,
      required: false,
      fallbackValue: null,
      value: null,
      source: "missing_optional",
      sendRequired: false,
    });
  }

  if (missingRequiredKey) {
    return {
      ok: false,
      missingRequiredKey,
      variables: renderVars,
      resolutions,
      warnings,
    };
  }

  return { ok: true, variables: renderVars, resolutions, warnings };
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
