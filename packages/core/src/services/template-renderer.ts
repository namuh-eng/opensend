import { render as renderReactEmail } from "@react-email/render";
import React from "react";
import type { ReactElement } from "react";

export type TemplateRenderVariables = Record<string, unknown>;

export type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
};

export type LegacyTemplateRenderInput = {
  kind?: "legacy";
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  variables?: TemplateRenderVariables;
};

export type ReactEmailTemplateRenderInput = {
  kind: "react_email";
  templateKey: string;
  variables?: TemplateRenderVariables;
};

export type TemplateRenderInput =
  | LegacyTemplateRenderInput
  | ReactEmailTemplateRenderInput;

export type TemplateRendererErrorCode =
  | "react_template_not_found"
  | "react_render_failed";

export class TemplateRendererError extends Error {
  constructor(
    readonly code: TemplateRendererErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TemplateRendererError";
  }
}

type ReactEmailTemplateDefinition = {
  subject: (variables: TemplateRenderVariables) => string;
  render: (variables: TemplateRenderVariables) => ReactElement;
};

function stringVariable(
  variables: TemplateRenderVariables,
  key: string,
  fallback: string,
): string {
  const value = variables[key];
  return value === null || value === undefined ? fallback : String(value);
}

function demoWelcomeTemplate(variables: TemplateRenderVariables): ReactElement {
  const recipientName = stringVariable(variables, "recipientName", "there");
  const productName = stringVariable(variables, "productName", "Opensend");
  const actionUrl = stringVariable(
    variables,
    "actionUrl",
    "https://opensend.dev",
  );

  return React.createElement(
    "html",
    null,
    React.createElement(
      "body",
      {
        style: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#111827",
        },
      },
      React.createElement("h1", null, `Welcome to ${productName}`),
      React.createElement("p", null, `Hi ${recipientName},`),
      React.createElement(
        "p",
        null,
        `This is a safe repo-owned React Email template rendered by ${productName}.`,
      ),
      React.createElement("a", { href: actionUrl }, "Get started"),
    ),
  );
}

const REACT_EMAIL_TEMPLATES = {
  "demo-welcome": {
    subject: (variables: TemplateRenderVariables) =>
      `Welcome to ${stringVariable(variables, "productName", "Opensend")}`,
    render: demoWelcomeTemplate,
  },
} satisfies Record<string, ReactEmailTemplateDefinition>;

export type ReactEmailTemplateKey = keyof typeof REACT_EMAIL_TEMPLATES;

export const reactEmailTemplateKeys = Object.keys(
  REACT_EMAIL_TEMPLATES,
) as ReactEmailTemplateKey[];

export function isReactEmailTemplateKey(
  key: string,
): key is ReactEmailTemplateKey {
  return Object.prototype.hasOwnProperty.call(REACT_EMAIL_TEMPLATES, key);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function interpolateLegacyTemplateContent(
  content: string,
  variables: TemplateRenderVariables = {},
): string {
  let rendered = content;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = escapeRegex(key);
    const regex = new RegExp(
      `{{{\\s*${escapedKey}\\s*}}}|{{\\s*${escapedKey}\\s*}}`,
      "g",
    );
    rendered = rendered.replace(regex, String(value));
  }
  return rendered;
}

export function renderLegacyTemplate(
  input: LegacyTemplateRenderInput,
): RenderedTemplate {
  const variables = input.variables ?? {};
  return {
    subject: interpolateLegacyTemplateContent(input.subject ?? "", variables),
    html: interpolateLegacyTemplateContent(input.html ?? "", variables),
    text: interpolateLegacyTemplateContent(input.text ?? "", variables),
  };
}

export async function renderReactEmailTemplate(
  input: ReactEmailTemplateRenderInput,
): Promise<RenderedTemplate> {
  if (!isReactEmailTemplateKey(input.templateKey)) {
    throw new TemplateRendererError(
      "react_template_not_found",
      `Unknown React Email template key: ${input.templateKey}`,
    );
  }

  const definition = REACT_EMAIL_TEMPLATES[input.templateKey];
  const variables = input.variables ?? {};
  const element = definition.render(variables);

  try {
    const [html, text] = await Promise.all([
      renderReactEmail(element),
      renderReactEmail(element, { plainText: true }),
    ]);

    return {
      subject: definition.subject(variables),
      html,
      text,
    };
  } catch (error) {
    throw new TemplateRendererError(
      "react_render_failed",
      `Failed to render React Email template: ${input.templateKey}`,
      { cause: error },
    );
  }
}

export async function renderTemplate(
  input: TemplateRenderInput,
): Promise<RenderedTemplate> {
  if (input.kind === "react_email") {
    return await renderReactEmailTemplate(input);
  }

  return renderLegacyTemplate(input);
}
