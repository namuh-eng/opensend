import { ReceivingList } from "@/components/receiving-list";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const domain = {
  id: "domain-1",
  name: "inbound.example.com",
  status: "active" as const,
  createdAt: "2026-06-08T00:00:00.000Z",
  receivingEnabled: true,
};

const route = {
  id: "route-1",
  domain_id: "domain-1",
  domain: "inbound.example.com",
  type: "exact" as const,
  local_part: "support",
  target_local_part: "support",
  target_address: "support@inbound.example.com",
};

const receivedEmail = {
  id: "received-1",
  from: "customer@example.com",
  to: ["support@inbound.example.com"],
  subject: "Inbound support request",
  html: "<p>Full HTML body</p>",
  text: "Full text body",
  status: "received",
  preview: "Can you help us with the onboarding checklist?",
  route_decisions: [
    {
      recipient: "support@inbound.example.com",
      status: "exact" as const,
      routeId: "route-1",
      routeType: "exact" as const,
      targetAddress: "support@inbound.example.com",
    },
  ],
  reply_match_status: "unmatched",
  thread_id: null,
  reply_to_email_id: null,
  contact_id: null,
  attachment_count: 0,
  created_at: "2026-06-08T00:05:00.000Z",
};

describe("ReceivingList", () => {
  it("renders received emails as the primary surface before configuration", () => {
    render(
      <ReceivingList
        domains={[domain]}
        routes={[route]}
        forwardingRules={[]}
        receivedEmails={[receivedEmail]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Received inbox" }),
    ).toBeDefined();
    expect(screen.getByText("customer@example.com")).toBeDefined();
    expect(screen.getByText("support@inbound.example.com")).toBeDefined();
    expect(screen.getByText("Inbound support request")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Receiving configuration" }),
    ).toBeDefined();
    expect(
      screen.getByLabelText(
        "Forwarding destinations for support@inbound.example.com",
      ),
    ).toBeDefined();
  });

  it("opens received email contents from the inbox", () => {
    render(
      <ReceivingList
        domains={[domain]}
        routes={[route]}
        forwardingRules={[]}
        receivedEmails={[receivedEmail]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open received email: Inbound support request",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Text" }));

    expect(screen.getByText("Full text body")).toBeDefined();
    expect(screen.getAllByText("From").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("customer@example.com").length).toBe(2);
  });

  it("uses development demo data when the inbox and config are empty", () => {
    render(
      <ReceivingList
        domains={[]}
        routes={[]}
        forwardingRules={[]}
        receivedEmails={[]}
        useDemoData
      />,
    );

    expect(
      screen.getByText("Can you confirm our onboarding window?"),
    ).toBeDefined();
    expect(screen.getByText("maya@customer.example")).toBeDefined();
    expect(screen.getByText("inbound.opliora.com")).toBeDefined();
    expect(screen.getByText("Demo data")).toBeDefined();
    expect(screen.getByText("Demo config")).toBeDefined();
  });

  it("keeps production empty states free of demo rows", () => {
    render(
      <ReceivingList
        domains={[]}
        routes={[]}
        forwardingRules={[]}
        receivedEmails={[]}
        useDemoData={false}
      />,
    );

    expect(screen.getByText("No received emails yet")).toBeDefined();
    expect(screen.getByText("No inbound domains configured.")).toBeDefined();
    expect(screen.queryByText("maya@customer.example")).toBeNull();
  });
});
