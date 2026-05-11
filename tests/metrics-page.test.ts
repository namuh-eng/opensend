// ABOUTME: Unit tests for the Metrics page layout — component structure, collapsible sections

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/metrics",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
});

describe("Metrics Page Layout", () => {
  describe("MetricsPage Component Structure", () => {
    it("should export a MetricsPage component", async () => {
      const mod = await import("../src/components/metrics-page");
      expect(mod.MetricsPage).toBeDefined();
      expect(typeof mod.MetricsPage).toBe("function");
    });

    it("should export MetricSection component for collapsible sections", async () => {
      const mod = await import("../src/components/metrics-page");
      expect(mod.MetricSection).toBeDefined();
      expect(typeof mod.MetricSection).toBe("function");
    });
  });

  describe("MetricSection collapsible behavior", () => {
    let MetricSection: React.FC<{
      title: string;
      value: string;
      defaultOpen?: boolean;
      infoButton?: boolean;
      children?: React.ReactNode;
    }>;

    beforeEach(async () => {
      const mod = await import("../src/components/metrics-page");
      MetricSection = mod.MetricSection;
    });

    it("should render section with title and value", () => {
      render(
        React.createElement(MetricSection, {
          title: "BOUNCE RATE",
          value: "0%",
          defaultOpen: true,
        }),
      );
      expect(screen.getByText("BOUNCE RATE")).toBeDefined();
      expect(screen.getByText("0%")).toBeDefined();
    });

    it("should be collapsible — toggle content visibility on click", () => {
      render(
        React.createElement(
          MetricSection,
          {
            title: "DELIVERABILITY RATE",
            value: "100%",
            defaultOpen: true,
          },
          React.createElement(
            "div",
            { "data-testid": "chart-content" },
            "Chart here",
          ),
        ),
      );
      // Content should be visible when open
      expect(screen.getByTestId("chart-content")).toBeDefined();

      // Click header to collapse
      const header = screen.getByText("DELIVERABILITY RATE").closest("button");
      expect(header).not.toBeNull();
      if (header) fireEvent.click(header);

      // Content should be hidden after toggle
      expect(screen.queryByTestId("chart-content")).toBeNull();
    });

    it("should start collapsed when defaultOpen is false", () => {
      render(
        React.createElement(
          MetricSection,
          {
            title: "COMPLAIN RATE",
            value: "0%",
            defaultOpen: false,
          },
          React.createElement(
            "div",
            { "data-testid": "hidden-content" },
            "Should not show",
          ),
        ),
      );
      // Content should NOT be visible
      expect(screen.queryByTestId("hidden-content")).toBeNull();
      // But the title should still be visible
      expect(screen.getByText("COMPLAIN RATE")).toBeDefined();
    });

    it("should expand collapsed section on click", () => {
      render(
        React.createElement(
          MetricSection,
          {
            title: "BOUNCE RATE",
            value: "2.5%",
            defaultOpen: false,
          },
          React.createElement(
            "div",
            { "data-testid": "expandable" },
            "Expanded content",
          ),
        ),
      );
      // Content should not be visible initially
      expect(screen.queryByTestId("expandable")).toBeNull();

      // Click to expand
      const header = screen.getByText("BOUNCE RATE").closest("button");
      if (header) fireEvent.click(header);

      // Content should now be visible
      expect(screen.getByTestId("expandable")).toBeDefined();
    });

    it("should show info button when infoButton prop is true", () => {
      const { container } = render(
        React.createElement(MetricSection, {
          title: "BOUNCE RATE",
          value: "0%",
          infoButton: true,
        }),
      );
      // Info icon (circle with i) should be present
      const infoSvgs = container.querySelectorAll("svg");
      expect(infoSvgs.length).toBeGreaterThanOrEqual(2); // chevron + info icon
    });
  });

  describe("MetricsPage tag filter behavior", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      const payload = {
        totalEmails: 3,
        deliverabilityRate: 100,
        bounceRate: 0,
        complainRate: 0,
        complained: 0,
        domains: ["example.com"],
        tagOptions: [
          { name: "campaign", values: ["launch", ""] },
          { name: "workflow", values: ["reset"] },
        ],
        dailyData: [{ date: "2026-05-11", count: 3 }],
        domainBreakdown: [{ domain: "example.com", count: 3, rate: 100 }],
        bounceBreakdown: {
          permanent: 0,
          transient: 0,
          undetermined: 0,
        },
        dailyBounceData: [],
        dailyComplainData: [],
        lastUpdated: "2026-05-11T00:00:00.000Z",
      };
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      );
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("renders tenant tag options and sends tag_name/tag_value query params", async () => {
      const { MetricsPage } = await import("../src/components/metrics-page");
      render(React.createElement(MetricsPage));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "/api/metrics?range=last_15_days",
        );
      });

      fireEvent.click(await screen.findByText("All Tags"));
      fireEvent.click(screen.getByText("campaign: launch"));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenLastCalledWith(
          "/api/metrics?range=last_15_days&tag_name=campaign&tag_value=launch",
        );
      });
    });

    it("can request a tag-name-only filter", async () => {
      const { MetricsPage } = await import("../src/components/metrics-page");
      render(React.createElement(MetricsPage));

      fireEvent.click(await screen.findByText("All Tags"));
      fireEvent.click(screen.getByText("workflow: Any value"));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenLastCalledWith(
          "/api/metrics?range=last_15_days&tag_name=workflow",
        );
      });
    });
  });
});
