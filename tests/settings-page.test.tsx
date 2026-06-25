import { SettingsPage } from "@/components/settings-page";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
          plan: { name: "Free", slug: "free" },
          transactional: {
            monthlyUsed: 12,
            monthlyLimit: 500,
            dailyUsed: 2,
            dailyLimit: 100,
          },
          marketing: {
            contactsUsed: 5,
            contactsLimit: 1000,
            segmentsUsed: 1,
            segmentsLimit: 3,
            broadcastsUsed: 0,
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

    await waitFor(() => expect(screen.getByText("12 / 500")).toBeTruthy());
    expect(mockFetch).toHaveBeenCalledWith("/api/usage");
  });

  it("ignores non-ok usage responses instead of treating errors as quota data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Missing or invalid API key" }),
    });

    render(<SettingsPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText("0 / 500")).toBeTruthy();
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

  it("renders the live unsubscribe page editor from the settings tab", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            logo_url: null,
            brand_color: "#10b981",
            headline: "Unsubscribed successfully",
            message:
              "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
            footer_text: "Powered by OpenSend",
            topics: [
              {
                id: "topic-1",
                name: "product update",
                description: "product update",
                default_subscription: "opt_in",
                visibility: "public",
              },
              {
                id: "topic-2",
                name: "test topic",
                description: "test",
                default_subscription: "opt_out",
                visibility: "public",
              },
            ],
          }),
      });

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe Page" }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith("/api/unsubscribe-page"),
    );
    expect(screen.getByRole("button", { name: /^Preferences$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "Success" })).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "Edit" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.getByText("Subscription preferences")).toBeDefined();
    expect(screen.getAllByText("product update").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("test topic")).toBeDefined();
    expect(screen.queryByText("Do you want to unsubscribe?")).toBeNull();
  });
});
