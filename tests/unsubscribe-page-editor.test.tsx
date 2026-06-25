import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string }) => {
    return React.createElement("a", { href, ...props }, children);
  },
}));

import { UnsubscribePageEditor } from "@/components/unsubscribe-page-editor";

describe("UnsubscribePageEditor", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders public topic preferences in the direct editor preview", async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/unsubscribe-page") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            logo_url: null,
            brand_color: "#10b981",
            headline: "Unsubscribed successfully",
            message: "Done",
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
              {
                id: "topic-3",
                name: "internal only",
                description: "private",
                default_subscription: "opt_in",
                visibility: "private",
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(<UnsubscribePageEditor />);

    await waitFor(() => {
      expect(screen.getByText("Subscription preferences")).toBeDefined();
    });

    expect(screen.getAllByText("product update").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("test topic")).toBeDefined();
    expect(screen.queryByText("internal only")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Update preferences",
      }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", {
        name: "Unsubscribe from all",
      }),
    ).toHaveProperty("disabled", true);
    expect(
      screen
        .getByRole("link", { name: "Powered by OpenSend" })
        .getAttribute("href"),
    ).toBe("https://opensend.namuh.co");
    expect(screen.queryByText("Do you want to unsubscribe?")).toBeNull();
  });
});
