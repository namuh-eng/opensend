import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock formatRelativeTime
vi.mock("@/components/emails-sending-data-table", () => ({
  formatRelativeTime: (date: string) => date,
}));

import { DomainDetail } from "@/components/domain-detail";
import type { DomainDetailData } from "@/components/domain-detail";

afterEach(cleanup);

function makeDomain(
  overrides: Partial<DomainDetailData> = {},
): DomainDetailData {
  return {
    id: "d-1",
    name: "example.com",
    status: "verified",
    region: "us-east-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    clickTracking: false,
    openTracking: false,
    trackingSubdomain: null,
    tls: "opportunistic",
    sendingEnabled: true,
    receivingEnabled: false,
    records: [],
    events: [{ type: "domain_added", timestamp: "2026-01-01T00:00:00.000Z" }],
    ...overrides,
  };
}

describe("Domain Configuration Tab", () => {
  function renderConfigTab(overrides: Partial<DomainDetailData> = {}) {
    render(<DomainDetail domain={makeDomain(overrides)} />);
    // Click Configuration tab
    const configTab = screen.getByText("Configuration");
    fireEvent.click(configTab);
  }

  it("renders Click Tracking toggle", () => {
    renderConfigTab();
    expect(screen.getByText("Click Tracking")).toBeDefined();
    const toggle = screen.getByRole("switch", { name: /click tracking/i });
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("renders Open Tracking toggle with Not Recommended label", () => {
    renderConfigTab();
    expect(screen.getByText("Open Tracking")).toBeDefined();
    expect(screen.getByText("Not Recommended")).toBeDefined();
    const toggle = screen.getByRole("switch", { name: /open tracking/i });
    expect(toggle.getAttribute("data-state")).toBe("unchecked");
  });

  it("renders TLS combobox with Opportunistic selected by default", () => {
    renderConfigTab();
    expect(screen.getByText("TLS")).toBeDefined();
    // TLS section should show a select/combobox with current value
    const tlsSelect = screen.getByTestId("tls-select");
    expect(tlsSelect).toBeDefined();
    expect((tlsSelect as HTMLSelectElement).value).toBe("opportunistic");
  });

  it("TLS combobox has exactly 2 options: Opportunistic and Enforced", () => {
    renderConfigTab();
    const tlsSelect = screen.getByTestId("tls-select") as HTMLSelectElement;
    const options = tlsSelect.querySelectorAll("option");
    expect(options.length).toBe(2);
    expect(options[0].value).toBe("opportunistic");
    expect(options[0].textContent).toBe("Opportunistic");
    expect(options[1].value).toBe("enforced");
    expect(options[1].textContent).toBe("Enforced");
  });

  it("TLS descriptions match expected text", () => {
    renderConfigTab();
    expect(screen.getByText(/attempts a secure connection/i)).toBeDefined();
  });

  it("Click Tracking toggle calls PATCH with click_tracking", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    renderConfigTab();
    const toggle = screen.getByRole("switch", { name: /click tracking/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("data-state")).toBe("checked");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/domains/d-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ click_tracking: true }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it("Open Tracking toggle calls PATCH with open_tracking", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    renderConfigTab();
    const toggle = screen.getByRole("switch", { name: /open tracking/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("data-state")).toBe("checked");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/domains/d-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ open_tracking: true }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it("TLS combobox change calls PATCH with tls value", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    renderConfigTab();
    const tlsSelect = screen.getByTestId("tls-select");
    fireEvent.change(tlsSelect, { target: { value: "enforced" } });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/domains/d-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ tls: "enforced" }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it("shows Enforced value when domain has tls='enforced'", () => {
    renderConfigTab({ tls: "enforced" });
    const tlsSelect = screen.getByTestId("tls-select") as HTMLSelectElement;
    expect(tlsSelect.value).toBe("enforced");
  });

  it("shows enabled toggles when tracking is on", () => {
    renderConfigTab({ clickTracking: true, openTracking: true });
    const clickToggle = screen.getByRole("switch", { name: /click tracking/i });
    const openToggle = screen.getByRole("switch", { name: /open tracking/i });
    expect(clickToggle.getAttribute("data-state")).toBe("checked");
    expect(openToggle.getAttribute("data-state")).toBe("checked");
  });

  it("renders and saves the custom tracking subdomain label", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    renderConfigTab({ trackingSubdomain: "links" });
    const input = screen.getByLabelText(
      "Custom tracking subdomain",
    ) as HTMLInputElement;

    expect(input.value).toBe("links");
    fireEvent.change(input, { target: { value: "clicks" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/domains/d-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ tracking_subdomain: "clicks" }),
      }),
    );
    fetchSpy.mockRestore();
  });
});
