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
  name: string;
  description: string;
  variables: ReactEmailTemplateVariableDefinition[];
  subject: (variables: TemplateRenderVariables) => string;
  render: (variables: TemplateRenderVariables) => ReactElement;
};

export type ReactEmailTemplateVariableDefinition = {
  key: string;
  name: string;
  type: "string" | "number";
  required: boolean;
  fallbackValue: string | number | null;
  description: string;
};

export type ReactEmailTemplateMetadata = {
  key: string;
  name: string;
  description: string;
  variables: ReactEmailTemplateVariableDefinition[];
};

function stringVariable(
  variables: TemplateRenderVariables,
  key: string,
  fallback: string,
): string {
  const value = variables[key];
  return value === null || value === undefined ? fallback : String(value);
}

const emailShellStyle = {
  margin: 0,
  padding: 0,
  backgroundColor: "#f4f7fb",
  color: "#182230",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} satisfies React.CSSProperties;

const cardStyle = {
  width: "100%",
  maxWidth: "640px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  overflow: "hidden",
  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
} satisfies React.CSSProperties;

const buttonStyle = {
  display: "inline-block",
  padding: "14px 22px",
  borderRadius: "999px",
  backgroundColor: "#111827",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  textDecoration: "none",
} satisfies React.CSSProperties;

function onboardingWelcomeTemplate(
  variables: TemplateRenderVariables,
): ReactElement {
  const recipientName = stringVariable(variables, "recipientName", "there");
  const productName = stringVariable(variables, "productName", "Opensend");
  const actionUrl = stringVariable(
    variables,
    "actionUrl",
    "https://opensend.dev/docs",
  );
  const supportEmail = stringVariable(
    variables,
    "supportEmail",
    "support@example.com",
  );

  return React.createElement(
    "html",
    null,
    React.createElement(
      "body",
      { style: emailShellStyle },
      React.createElement(
        "div",
        { style: { display: "none", maxHeight: 0, overflow: "hidden" } },
        `Start sending production email with ${productName}.`,
      ),
      React.createElement(
        "table",
        {
          role: "presentation",
          width: "100%",
          cellPadding: "0",
          cellSpacing: "0",
          style: { backgroundColor: "#f4f7fb", padding: "32px 16px" },
        },
        React.createElement(
          "tbody",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement(
              "td",
              { align: "center" },
              React.createElement(
                "div",
                { style: cardStyle },
                React.createElement(
                  "div",
                  {
                    style: {
                      padding: "28px 32px",
                      background:
                        "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      style: {
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(255,255,255,0.14)",
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      },
                    },
                    productName,
                  ),
                  React.createElement(
                    "h1",
                    {
                      style: {
                        margin: "24px 0 10px",
                        fontSize: "34px",
                        lineHeight: "40px",
                        letterSpacing: "-0.03em",
                      },
                    },
                    "Your email workspace is ready",
                  ),
                  React.createElement(
                    "p",
                    {
                      style: {
                        margin: 0,
                        maxWidth: "520px",
                        color: "#dbeafe",
                        fontSize: "17px",
                        lineHeight: "27px",
                      },
                    },
                    `Hi ${recipientName}, here is the fastest path to send a trustworthy first production message.`,
                  ),
                ),
                React.createElement(
                  "div",
                  { style: { padding: "32px" } },
                  React.createElement(
                    "p",
                    {
                      style: {
                        margin: "0 0 22px",
                        fontSize: "16px",
                        lineHeight: "26px",
                        color: "#344054",
                      },
                    },
                    "Verify your sending domain, create an API key, and send a sandbox message before moving real customer traffic. Your dashboard keeps previews, events, and provider status in one place.",
                  ),
                  React.createElement(
                    "a",
                    { href: actionUrl, style: buttonStyle },
                    "Open the setup checklist",
                  ),
                  React.createElement(
                    "table",
                    {
                      role: "presentation",
                      width: "100%",
                      cellPadding: "0",
                      cellSpacing: "0",
                      style: { marginTop: "30px" },
                    },
                    React.createElement(
                      "tbody",
                      null,
                      [
                        [
                          "1",
                          "Authenticate",
                          "Add your domain and publish DKIM, SPF, and DMARC records.",
                        ],
                        [
                          "2",
                          "Integrate",
                          "Use the Resend-compatible API or SDK with your self-hosted base URL.",
                        ],
                        [
                          "3",
                          "Observe",
                          "Watch delivery events, bounces, and complaints in the dashboard.",
                        ],
                      ].map(([step, title, copy]) =>
                        React.createElement(
                          "tr",
                          { key: step },
                          React.createElement(
                            "td",
                            {
                              style: {
                                padding: "14px 0",
                                borderTop: "1px solid #eaecf0",
                              },
                            },
                            React.createElement(
                              "div",
                              {
                                style: {
                                  display: "flex",
                                  gap: "14px",
                                  alignItems: "flex-start",
                                },
                              },
                              React.createElement(
                                "div",
                                {
                                  style: {
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "999px",
                                    backgroundColor: "#eff6ff",
                                    color: "#1d4ed8",
                                    fontWeight: 800,
                                    lineHeight: "30px",
                                    textAlign: "center",
                                    flex: "0 0 auto",
                                  },
                                },
                                step,
                              ),
                              React.createElement(
                                "div",
                                null,
                                React.createElement(
                                  "div",
                                  {
                                    style: {
                                      color: "#101828",
                                      fontWeight: 700,
                                      fontSize: "15px",
                                    },
                                  },
                                  title,
                                ),
                                React.createElement(
                                  "div",
                                  {
                                    style: {
                                      marginTop: "4px",
                                      color: "#667085",
                                      fontSize: "14px",
                                      lineHeight: "22px",
                                    },
                                  },
                                  copy,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  React.createElement(
                    "p",
                    {
                      style: {
                        margin: "28px 0 0",
                        color: "#667085",
                        fontSize: "13px",
                        lineHeight: "21px",
                      },
                    },
                    `Need help? Reply to this email or contact ${supportEmail}.`,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
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
  "onboarding-welcome": {
    name: "Onboarding welcome",
    description:
      "A production-ready first-run welcome email with setup checklist, CTA, and support footer.",
    variables: [
      {
        key: "recipientName",
        name: "Recipient name",
        type: "string",
        required: false,
        fallbackValue: "there",
        description: "Friendly name used in the opening line.",
      },
      {
        key: "productName",
        name: "Product name",
        type: "string",
        required: false,
        fallbackValue: "Opensend",
        description: "Brand or workspace name shown in the hero.",
      },
      {
        key: "actionUrl",
        name: "Setup checklist URL",
        type: "string",
        required: true,
        fallbackValue: null,
        description: "Required send-time CTA URL for the setup checklist.",
      },
      {
        key: "supportEmail",
        name: "Support email",
        type: "string",
        required: false,
        fallbackValue: "support@example.com",
        description: "Reply-to/support address shown in the footer.",
      },
    ],
    subject: (variables: TemplateRenderVariables) =>
      `Welcome to ${stringVariable(variables, "productName", "Opensend")}`,
    render: onboardingWelcomeTemplate,
  },
  "demo-welcome": {
    name: "Demo welcome",
    description:
      "Minimal registry fixture retained for tests and existing stored templates.",
    variables: [
      {
        key: "recipientName",
        name: "Recipient name",
        type: "string",
        required: false,
        fallbackValue: "there",
        description: "Friendly name used in the opening line.",
      },
      {
        key: "productName",
        name: "Product name",
        type: "string",
        required: false,
        fallbackValue: "Opensend",
        description: "Product name used in the heading and subject.",
      },
      {
        key: "actionUrl",
        name: "Action URL",
        type: "string",
        required: false,
        fallbackValue: "https://opensend.dev",
        description: "CTA URL.",
      },
    ],
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

export const reactEmailTemplateCatalog = Object.entries(
  REACT_EMAIL_TEMPLATES,
).map(([key, definition]) => ({
  key,
  name: definition.name,
  description: definition.description,
  variables: definition.variables.map((variable) => ({ ...variable })),
})) satisfies ReactEmailTemplateMetadata[];

export function getReactEmailTemplateMetadata(
  key: ReactEmailTemplateKey,
): ReactEmailTemplateMetadata {
  const definition = REACT_EMAIL_TEMPLATES[key];
  return {
    key,
    name: definition.name,
    description: definition.description,
    variables: definition.variables.map((variable) => ({ ...variable })),
  };
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
