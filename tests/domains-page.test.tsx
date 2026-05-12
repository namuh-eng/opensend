import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { DomainsPage } from "@/components/domains-page";

const mockDomains = [
  {
    id: "d1",
    name: "example.com",
    status: "verified",
    region: "us-east-1",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "d2",
    name: "test.io",
    status: "pending",
    region: "eu-west-1",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "d3",
    name: "fail.dev",
    status: "failed",
    region: "sa-east-1",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "d4",
    name: "new.org",
    status: "not_started",
    region: "ap-northeast-1",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

afterEach(cleanup);

describe("Domains Page", () => {
  it("renders page title and Add domain button", () => {
    render(<DomainsPage domains={mockDomains} />);
    expect(screen.getByRole("heading", { name: "Domains" })).toBeDefined();
    expect(screen.getByText("Add domain")).toBeDefined();
  });

  it("renders domain status badge with correct variant for each status", () => {
    render(<DomainsPage domains={mockDomains} />);
    // verified = success (green)
    const verifiedBadge = screen.getByText("Verified");
    expect(verifiedBadge.className).toContain("green");
    // pending = warning (yellow)
    const pendingBadge = screen.getByText("Pending");
    expect(pendingBadge.className).toContain("yellow");
    // failed = error (red)
    const failedBadge = screen.getByText("Failed");
    expect(failedBadge.className).toContain("red");
    // not_started = default (gray)
    const notStartedBadge = screen.getByText("Not Started");
    expect(notStartedBadge.className).toContain("A1A4A5");
  });

  it("renders region display with friendly name and code", () => {
    render(<DomainsPage domains={mockDomains} />);
    expect(screen.getByText(/North Virginia/)).toBeDefined();
    expect(screen.getByText(/us-east-1/)).toBeDefined();
    expect(screen.getByText(/Ireland/)).toBeDefined();
    expect(screen.getByText(/eu-west-1/)).toBeDefined();
    expect(screen.getByText(/São Paulo/)).toBeDefined();
    expect(screen.getByText(/sa-east-1/)).toBeDefined();
    expect(screen.getByText(/Tokyo/)).toBeDefined();
    expect(screen.getByText(/ap-northeast-1/)).toBeDefined();
  });

  it("renders domain names as clickable links to detail pages", () => {
    render(<DomainsPage domains={mockDomains} />);
    const link = screen.getByText("example.com").closest("a");
    expect(link?.getAttribute("href")).toBe("/domains/d1");
  });

  it("renders data table columns: Domain, Status, Region, Created", () => {
    render(<DomainsPage domains={mockDomains} />);
    expect(screen.getByText("Domain")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Region")).toBeDefined();
    expect(screen.getByText("Created")).toBeDefined();
  });

  it("filters domains by search input", () => {
    render(<DomainsPage domains={mockDomains} />);
    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "example" } });
    expect(screen.getByText("example.com")).toBeDefined();
    expect(screen.queryByText("test.io")).toBeNull();
  });

  it("filters domains by status", () => {
    render(<DomainsPage domains={mockDomains} />);
    // Click the status filter button
    const statusBtn = screen.getByText("All Statuses");
    fireEvent.click(statusBtn);
    // The dropdown options are inside buttons with span children
    // Find the dropdown option button whose span text is "Verified"
    const dropdownButtons = document.querySelectorAll(
      "[class*='min-w-'] button",
    );
    const verifiedBtn = Array.from(dropdownButtons).find((btn) =>
      btn.textContent?.includes("Verified"),
    );
    expect(verifiedBtn).toBeDefined();
    fireEvent.click(verifiedBtn as Element);
    // Only verified domain should remain
    expect(screen.getByText("example.com")).toBeDefined();
    expect(screen.queryByText("test.io")).toBeNull();
  });

  it("shows empty state when no domains match filter", () => {
    render(<DomainsPage domains={[]} />);
    expect(screen.getByText("No domains found")).toBeDefined();
  });

  it("renders row action buttons for each domain", () => {
    render(<DomainsPage domains={mockDomains} />);
    const actionBtns = screen.getAllByLabelText("More actions");
    expect(actionBtns.length).toBe(mockDomains.length);
  });

  it("renders relative time for Created column", () => {
    render(<DomainsPage domains={mockDomains} />);
    expect(screen.getByText(/about 1 hour ago/)).toBeDefined();
    expect(screen.getByText(/about 2 hours ago/)).toBeDefined();
    expect(screen.getByText(/about 1 day ago/)).toBeDefined();
    expect(screen.getByText(/about 2 days ago/)).toBeDefined();
  });

  it("renders export button", () => {
    render(<DomainsPage domains={mockDomains} />);
    expect(screen.getByLabelText("Export")).toBeDefined();
  });

  it("submits an advanced tracking subdomain label when adding a domain", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "domain-new" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<DomainsPage domains={mockDomains} />);
    fireEvent.click(screen.getByRole("button", { name: "Add domain" }));
    fireEvent.change(screen.getByPlaceholderText("yourdomain.com"), {
      target: { value: "example.com" },
    });
    fireEvent.click(screen.getByText("Advanced options"));
    fireEvent.change(screen.getByPlaceholderText("links"), {
      target: { value: "links" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/domains",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "example.com",
            tracking_subdomain: "links",
          }),
        }),
      );
    });

    fetchSpy.mockRestore();
  });
});
