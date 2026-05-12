import { describe, expect, it } from "vitest";
import {
  type TemplateRendererError,
  interpolateLegacyTemplateContent,
  renderLegacyTemplate,
  renderReactEmailTemplate,
  renderTemplate,
} from "../packages/core/src/services/template-renderer";

describe("template renderer", () => {
  it("preserves legacy double and triple brace interpolation without crashing on missing variables", () => {
    expect(
      interpolateLegacyTemplateContent("Hello {{ FIRST_NAME }}", {
        FIRST_NAME: "Ada",
      }),
    ).toBe("Hello Ada");

    expect(
      renderLegacyTemplate({
        subject: "Receipt for {{ PRODUCT }}",
        html: "<p>{{{ PRODUCT }}}</p><p>{{ MISSING }}</p>",
        text: "{{ PRODUCT }} costs {{ PRICE }} and {{ MISSING }} stays",
        variables: { PRODUCT: "Widget", PRICE: 25 },
      }),
    ).toEqual({
      subject: "Receipt for Widget",
      html: "<p>Widget</p><p>{{ MISSING }}</p>",
      text: "Widget costs 25 and {{ MISSING }} stays",
    });
  });

  it("renders a controlled React Email template to HTML and plain text", async () => {
    const rendered = await renderReactEmailTemplate({
      kind: "react_email",
      templateKey: "demo-welcome",
      variables: {
        recipientName: "Ada",
        productName: "Opensend",
        actionUrl: "https://example.com/start",
      },
    });

    expect(rendered.subject).toBe("Welcome to Opensend");
    expect(rendered.html).toContain("Welcome to Opensend");
    expect(rendered.html).toContain("https://example.com/start");
    expect(rendered.text).toContain("WELCOME TO OPENSEND");
    expect(rendered.text).toContain("Hi Ada");
    expect(rendered.text).toContain("Get started");
  });

  it("routes through the shared renderer boundary for legacy and React Email inputs", async () => {
    await expect(
      renderTemplate({
        subject: "Hi {{ NAME }}",
        html: "<p>{{ NAME }}</p>",
        text: "{{ NAME }}",
        variables: { NAME: "Grace" },
      }),
    ).resolves.toEqual({
      subject: "Hi Grace",
      html: "<p>Grace</p>",
      text: "Grace",
    });

    await expect(
      renderTemplate({
        kind: "react_email",
        templateKey: "demo-welcome",
        variables: { productName: "Opensend" },
      }),
    ).resolves.toMatchObject({
      subject: "Welcome to Opensend",
    });
  });

  it("fails unknown React Email template keys with a typed domain error", async () => {
    await expect(
      renderReactEmailTemplate({
        kind: "react_email",
        templateKey: "tenant-provided-tsx-string",
        variables: {},
      }),
    ).rejects.toMatchObject({
      name: "TemplateRendererError",
      code: "react_template_not_found",
      message: "Unknown React Email template key: tenant-provided-tsx-string",
    } satisfies Partial<TemplateRendererError>);
  });
});
