import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.stubGlobal("fetch", mockFetch);

import { WebhooksList } from "@/components/webhooks-list";

const supportedEventTypes = [
  "email.sent",
  "email.delivered",
  "contact.created",
] as const;

const existingWebhooks = [
  {
    id: "wh-1",
    url: "https://example.com/webhook",
    status: "active" as const,
    eventTypes: ["email.sent"],
    createdAt: "2026-05-11T00:00:00.000Z",
  },
];

describe("WebhooksList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "wh-created",
        endpoint: "https://example.com/opensend",
        signing_secret: "whsec_created",
      }),
    });
  });

  afterEach(cleanup);

  it("exposes a visible create action in the empty state", () => {
    render(
      <WebhooksList supportedEventTypes={supportedEventTypes} webhooks={[]} />,
    );

    expect(screen.getByRole("heading", { name: "Webhooks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add endpoint" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add your first endpoint" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first endpoint" }),
    );

    expect(screen.getByText("Add webhook endpoint")).toBeTruthy();
    expect(screen.getByLabelText("Endpoint URL")).toBeTruthy();
    expect(screen.getByLabelText("email.sent")).toBeTruthy();
  });

  it("exposes a create action when webhooks already exist", () => {
    render(
      <WebhooksList
        supportedEventTypes={supportedEventTypes}
        webhooks={existingWebhooks}
      />,
    );

    expect(screen.getByRole("button", { name: "Add endpoint" })).toBeTruthy();
    expect(screen.getByText("https://example.com/webhook")).toBeTruthy();
  });

  it("posts a selected endpoint and events, then reveals the signing secret", async () => {
    render(
      <WebhooksList supportedEventTypes={supportedEventTypes} webhooks={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));
    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "https://example.com/opensend" },
    });
    fireEvent.click(screen.getByLabelText("email.sent"));
    fireEvent.click(screen.getByRole("button", { name: "Create endpoint" }));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/webhooks",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://example.com/opensend",
          events: ["email.sent"],
        }),
      }),
    );
    expect(await screen.findByText("Webhook endpoint created")).toBeTruthy();
    expect(screen.getByText("whsec_created")).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalled();
  });
});
