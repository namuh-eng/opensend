import { SettingsPage } from "@/components/settings-page";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

afterEach(cleanup);

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads usage through the dashboard session flow without an API key header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          transactional: {
            monthlyUsed: 12,
            monthlyLimit: 3000,
            dailyUsed: 2,
            dailyLimit: 100,
          },
          marketing: {
            contactsUsed: 5,
            contactsLimit: 1000,
            segmentsUsed: 1,
            segmentsLimit: 3,
            broadcastsLimit: "Unlimited",
          },
          team: {
            domainsUsed: 2,
            domainsLimit: 3,
            rateLimit: 2,
          },
        }),
    });

    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("12 / 3,000")).toBeTruthy());
    expect(mockFetch).toHaveBeenCalledWith("/api/usage");
  });

  it("ignores non-ok usage responses instead of treating errors as quota data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Missing or invalid API key" }),
    });

    render(<SettingsPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText("0 / 3,000")).toBeTruthy();
    expect(screen.queryByText("Missing or invalid API key")).toBeNull();
  });

  it("hides the billing settings tab when billing is disabled", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<SettingsPage billingEnabled={false} />);

    expect(screen.queryByRole("button", { name: "Billing" })).toBeNull();
  });

  it("shows the billing settings tab when billing is enabled", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<SettingsPage billingEnabled={true} />);

    expect(screen.getByRole("button", { name: "Billing" })).toBeDefined();
  });
});
