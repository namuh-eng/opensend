import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { TemplateEditor } from "@/components/template-editor";

const templateResponse = {
  object: "template",
  id: "tmpl-1",
  name: "Welcome Email",
  alias: "welcome-email",
  status: "draft",
  subject: "Welcome {{name}}",
  from: "Acme <hello@example.com>",
  reply_to: "support@example.com",
  preview_text: "Start here",
  html: "<h1>Hello {{name}}</h1>",
  text: "Hello {{name}}",
  variables: [],
  created_at: "2026-05-23T00:00:00.000Z",
  updated_at: "2026-05-23T00:00:00.000Z",
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("TemplateEditor", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(jsonResponse(templateResponse));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads an existing template into editable fields", async () => {
    render(<TemplateEditor templateId="tmpl-1" />);

    expect(await screen.findByDisplayValue("Welcome Email")).toBeTruthy();
    expect(screen.getByDisplayValue("welcome-email")).toBeTruthy();
    expect(screen.getByDisplayValue("Welcome {{name}}")).toBeTruthy();
    expect(screen.getByTitle("Template editor live preview")).toBeTruthy();
    expect(screen.getByLabelText("Template content editor")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith("/api/templates/tmpl-1", {
      headers: {},
    });
  });

  it("saves edited template fields through the template API", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(templateResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          ...templateResponse,
          name: "Updated Welcome",
          html: "<h1>Updated</h1>",
        }),
      );

    render(<TemplateEditor templateId="tmpl-1" />);

    const name = await screen.findByLabelText("Template name");
    fireEvent.change(name, { target: { value: "Updated Welcome" } });
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    fireEvent.change(screen.getByLabelText("HTML"), {
      target: { value: "<h1>Updated</h1>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/templates/tmpl-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            name: "Updated Welcome",
            alias: "welcome-email",
            from: "Acme <hello@example.com>",
            reply_to: "support@example.com",
            subject: "Welcome {{name}}",
            preview_text: "Start here",
            html: "<h1>Updated</h1>",
            text: "Hello {{name}}",
          }),
        }),
      );
    });
    expect(await screen.findByText("Template saved.")).toBeTruthy();
  });

  it("publishes saved draft templates", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(templateResponse))
      .mockResolvedValueOnce(
        jsonResponse({
          object: "template",
          id: "tmpl-1",
          status: "published",
          published_at: "2026-05-23T00:01:00.000Z",
          has_unpublished_versions: false,
        }),
      );

    render(<TemplateEditor templateId="tmpl-1" />);

    await screen.findByDisplayValue("Welcome Email");
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/templates/tmpl-1/publish",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Template published.")).toBeTruthy();
  });
});
