import { WebhooksList } from "@/components/webhooks-list";
import {
  createWebhookSchema,
  updateWebhookSchema,
} from "@/lib/validation/webhooks";
import { SUPPORTED_WEBHOOK_EVENT_TYPES } from "@namuh/core/src/webhook-events";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("webhook event type support", () => {
  it("accepts every shared supported webhook event type for create and update", () => {
    expect(
      createWebhookSchema.safeParse({
        endpoint: "https://example.com/webhooks",
        events: [...SUPPORTED_WEBHOOK_EVENT_TYPES],
      }).success,
    ).toBe(true);

    expect(
      updateWebhookSchema.safeParse({
        event_types: [...SUPPORTED_WEBHOOK_EVENT_TYPES],
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported webhook event names", () => {
    expect(
      createWebhookSchema.safeParse({
        endpoint: "https://example.com/webhooks",
        events: ["email.delivered", "email.unknown"],
      }).success,
    ).toBe(false);

    expect(
      updateWebhookSchema.safeParse({
        events: ["delivered"],
      }).success,
    ).toBe(false);
  });

  it("renders dashboard event labels from the shared supported set", () => {
    render(
      <WebhooksList
        supportedEventTypes={[...SUPPORTED_WEBHOOK_EVENT_TYPES]}
        webhooks={[
          {
            id: "wh-1",
            url: "https://example.com/webhook",
            status: "active",
            eventTypes: ["email.delivered", "email.unknown"],
            createdAt: "2026-04-23T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("email.delivered")).toBeTruthy();
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.queryByText("email.unknown")).toBeNull();
  });
});
