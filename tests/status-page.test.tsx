import { StatusPage } from "@/components/status/status-page";
import type { PublicStatusSnapshot } from "@opensend/core";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const snapshot: PublicStatusSnapshot = {
  status: "operational",
  headline: "Core systems operational",
  message:
    "We are not aware of any incidents affecting monitored OpenSend systems.",
  generatedAt: "2026-05-11T12:00:00.000Z",
  components: [
    {
      id: "app_api",
      name: "App / API",
      description: "Next.js application shell and public API runtime.",
      status: "operational",
      statusLabel: "Operational",
      message:
        "Application runtime and database-backed API probe are reachable.",
      lastCheckedAt: "2026-05-11T12:00:00.000Z",
      uptime: {
        percentage: 100,
        windowDays: 90,
        source: "incident-history",
        label: "100.00% uptime",
      },
    },
    {
      id: "ingester_webhooks",
      name: "Ingester / Webhooks",
      description:
        "SES/SNS ingestion, webhook dispatch, and background workers.",
      status: "unknown",
      statusLabel: "Probe not configured",
      message:
        "Set INGESTER_HEALTH_URL to expose the ingester /health probe here.",
      lastCheckedAt: null,
      uptime: {
        percentage: 100,
        windowDays: 90,
        source: "incident-history",
        label: "100.00% uptime",
      },
    },
  ],
  history: [
    {
      id: "no-incidents-2026-05-11",
      date: "2026-05-11",
      title: "No incidents",
      summary: "No incidents recorded for OpenSend components.",
      impact: "none",
    },
  ],
  incidentSource: {
    type: "empty-in-repo-source",
    description:
      "This first public status slice has no durable incident store yet.",
  },
  actions: {
    subscribe: {
      label: "Subscribe to updates",
      href: "#subscribe-placeholder",
      note: "Subscription delivery is a placeholder.",
    },
    report: {
      label: "Report a problem",
      href: "https://github.com/namuh-eng/opensend/issues/new?title=Status%20report",
      note: "Report public incidents through GitHub.",
    },
    history: {
      label: "View history",
      href: "#incident-history",
      note: "History currently reflects the documented empty incident source.",
    },
  },
};

describe("StatusPage", () => {
  it("renders public status headline, actions, component uptime, and incident history", () => {
    render(<StatusPage status={snapshot} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Core systems operational",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /subscribe to updates/i }),
    ).toBeDefined();
    const reportLink = screen.getByRole("link", { name: /report a problem/i });
    expect(reportLink.getAttribute("href")).toContain(
      "github.com/namuh-eng/opensend",
    );

    const apiComponent = screen.getByTestId("status-component-app_api");
    expect(within(apiComponent).getByText("100.00% uptime")).toBeDefined();
    expect(within(apiComponent).getByText("Operational")).toBeDefined();

    const ingesterComponent = screen.getByTestId(
      "status-component-ingester_webhooks",
    );
    expect(
      within(ingesterComponent).getByText("Probe not configured"),
    ).toBeDefined();
    expect(screen.getByText("No incidents")).toBeDefined();
    expect(screen.getByText("2026-05-11")).toBeDefined();
  });
});
