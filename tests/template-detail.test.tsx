import { TemplateDetail } from "@/components/template-detail";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const template = {
  id: "tmpl-1",
  name: "Onboarding welcome",
  alias: "onboarding-welcome",
  from: null,
  subject: null,
  html: "<p>Stored placeholder</p>",
  text: null,
  published: false,
  variables: [
    { name: "productName", key: "productName", required: false },
    { name: "actionUrl", key: "actionUrl", required: true },
  ],
  createdAt: "2026-05-12T00:00:00.000Z",
  updatedAt: "2026-05-12T00:00:00.000Z",
};

describe("TemplateDetail", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        subject: "Welcome to Opensend",
        html: "<h1>Your email workspace is ready</h1>",
        text: "YOUR EMAIL WORKSPACE IS READY\nOpen the setup checklist",
        rendering: {
          kind: "react_email",
          template_key: "onboarding-welcome",
        },
        variables: [
          {
            key: "productName",
            name: "Product name",
            type: "string",
            required: false,
            fallbackValue: "Opensend",
            value: "Opensend",
            source: "fallback",
            sendRequired: false,
          },
          {
            key: "actionUrl",
            name: "Setup checklist URL",
            type: "string",
            required: true,
            fallbackValue: null,
            value: "Sample Setup checklist URL",
            source: "preview_sample",
            sendRequired: true,
          },
        ],
        warnings: [
          "Using fallback for productName.",
          "Preview uses a sample value for required variable actionUrl; production sends must provide it.",
        ],
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows shared-renderer HTML, text, and variable/fallback diagnostics", async () => {
    render(<TemplateDetail template={template} />);

    expect(await screen.findByText("Production renderer preview")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/React Email registry template:/)).toBeTruthy();
    });

    expect(screen.getByText("Welcome to Opensend")).toBeTruthy();
    expect(screen.getByText("Variable resolution")).toBeTruthy();
    expect(screen.getByText("Fallback")).toBeTruthy();
    expect(screen.getByText("Preview sample")).toBeTruthy();
    expect(screen.getByText("Required before send")).toBeTruthy();
    expect(screen.getByTestId("template-html-preview")).toBeTruthy();
    expect(screen.getByTestId("template-text-preview").textContent).toContain(
      "Open the setup checklist",
    );
  });
});
