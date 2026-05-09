import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

import { DomainDetail } from "@/components/domain-detail";
import type { DomainDetailData } from "@/components/domain-detail";

const baseDomain: DomainDetailData = {
  id: "d1",
  name: "foreverbrowsing.com",
  status: "not_started",
  region: "us-east-1",
  createdAt: new Date().toISOString(),
  clickTracking: false,
  openTracking: false,
  tls: "opportunistic",
  sendingEnabled: true,
  receivingEnabled: false,
  records: [],
  events: [{ type: "domain_added", timestamp: new Date().toISOString() }],
};

afterEach(cleanup);

describe("Domain detail – Verify button", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("does not render Verify button when domain is verified", () => {
    render(<DomainDetail domain={{ ...baseDomain, status: "verified" }} />);
    expect(screen.queryByText("Verify DNS Records")).toBeNull();
  });

  it("renders Verify button for unverified domain and POSTs to /verify on click", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DomainDetail domain={baseDomain} />);
    const button = screen.getByText("Verify DNS Records");
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/domains/d1/verify",
        expect.objectContaining({ method: "POST" }),
      );
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows error message when verify request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DomainDetail domain={baseDomain} />);
    fireEvent.click(screen.getByText("Verify DNS Records"));

    await vi.waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Domain not found",
      );
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
