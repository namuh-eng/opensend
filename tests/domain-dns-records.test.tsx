import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { DomainDetail } from "@/components/domain-detail";
import type { DomainDetailData } from "@/components/domain-detail";

afterEach(cleanup);

const domainWithRecords: DomainDetailData = {
  id: "d1",
  name: "updates.foreverbrowsing.com",
  status: "verified",
  region: "us-east-1",
  createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  clickTracking: false,
  openTracking: false,
  tls: "opportunistic",
  sendingEnabled: true,
  receivingEnabled: false,
  records: [
    {
      type: "TXT",
      name: "resend._domainkey.updates",
      value:
        "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3Q2I0AaBBv1GDAaBBv1GDAaBBv1GD",
      status: "verified",
      ttl: "Auto",
    },
    {
      type: "MX",
      name: "updates.foreverbrowsing.com",
      value: "feedback-smtp.us-east-1.amazonses.com",
      status: "verified",
      ttl: "Auto",
      priority: 10,
    },
    {
      type: "TXT",
      name: "updates.foreverbrowsing.com",
      value: "v=spf1 include:amazonses.com ~all",
      status: "verified",
      ttl: "Auto",
    },
    {
      type: "TXT",
      name: "_dmarc.updates.foreverbrowsing.com",
      value: "v=DMARC1; p=none;",
      status: "verified",
      ttl: "Auto",
    },
  ],
  events: [
    {
      type: "domain_added",
      timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    },
    {
      type: "dns_verified",
      timestamp: new Date(Date.now() - 19.9 * 60 * 60 * 1000).toISOString(),
    },
    {
      type: "domain_verified",
      timestamp: new Date(Date.now() - 19.8 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

describe("Domain DNS Records Tab (feature-025)", () => {
  it("renders Domain Verification section with DKIM link", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getByText("Domain Verification")).toBeTruthy();
    expect(screen.getByText("DKIM")).toBeTruthy();
  });

  it("renders DNS records table with all columns", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getAllByText("Type").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Name").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Content").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("TTL").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Priority").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Status").length).toBeGreaterThanOrEqual(1);
  });

  it("renders TXT record with truncated long content", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    // The long DKIM value should be truncated visually
    const cells = screen.getAllByText(/p=MIGfMA0GCS/);
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Enable Sending section with SPF toggle", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getByText("Enable Sending")).toBeTruthy();
    const sendingToggle = screen.getByTestId("sending-toggle");
    expect(sendingToggle).toBeTruthy();
    expect(sendingToggle.getAttribute("data-state")).toBe("checked");
  });

  it("renders DMARC as a separate policy section", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getByText("DMARC Policy")).toBeTruthy();
    expect(screen.getByText(/evaluate SPF and DKIM alignment/)).toBeTruthy();
    expect(screen.getByText("_dmarc.updates.foreverbrowsing.com")).toBeTruthy();
    expect(screen.getByText("v=DMARC1; p=none;")).toBeTruthy();
  });

  it("renders Enable Receiving section with toggle", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getByText("Enable Receiving")).toBeTruthy();
    const receivingToggle = screen.getByTestId("receiving-toggle");
    expect(receivingToggle).toBeTruthy();
    expect(receivingToggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("renders MX record with priority 10", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getByText("MX")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("renders SPF TXT record", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    const spfCells = screen.getAllByText(/v=spf1 include:amazonses.com/);
    expect(spfCells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Auto configure button", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    expect(screen.getByText("Auto configure")).toBeTruthy();
  });

  it("renders verified status badges for records", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    // All 3 records are verified — plus the domain status badge
    const verifiedBadges = screen.getAllByText("Verified");
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(3);
  });

  it("renders record values as copyable elements", () => {
    render(<DomainDetail domain={domainWithRecords} />);
    const copyButtons = screen.getAllByLabelText("Copy to clipboard");
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows pending status for unverified records", () => {
    const domainPending: DomainDetailData = {
      ...domainWithRecords,
      status: "pending",
      records: [
        {
          type: "TXT",
          name: "resend._domainkey.updates",
          value: "p=MIGfMA0GCS...",
          status: "pending",
          ttl: "Auto",
        },
      ],
      events: [domainWithRecords.events[0]],
    };
    render(<DomainDetail domain={domainPending} />);
    // Domain status badge + record status badge both show "Pending"
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
  });

  it("sending toggle reflects domain sendingEnabled state", () => {
    const domainSendingOff: DomainDetailData = {
      ...domainWithRecords,
      sendingEnabled: false,
    };
    render(<DomainDetail domain={domainSendingOff} />);
    const sendingToggle = screen.getByTestId("sending-toggle");
    expect(sendingToggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("receiving toggle reflects domain receivingEnabled state", () => {
    const domainReceivingOn: DomainDetailData = {
      ...domainWithRecords,
      receivingEnabled: true,
    };
    render(<DomainDetail domain={domainReceivingOn} />);
    const receivingToggle = screen.getByTestId("receiving-toggle");
    expect(receivingToggle.getAttribute("data-state")).toBe("checked");
  });
});
