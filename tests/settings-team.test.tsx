// ABOUTME: Unit tests for the Settings Team tab — member action availability and explanatory copy

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
        },
      },
      isPending: false,
    }),
  },
}));

import { TeamTab } from "@/components/settings-team";

afterEach(cleanup);

describe("TeamTab", () => {
  it("disables Invite member with explanatory copy while team management is unavailable", () => {
    render(<TeamTab />);

    expect(
      screen.getByText(/Team invitations and role editing are not available/),
    ).toBeDefined();

    const inviteButton = screen.getByRole("button", {
      name: "Invite member",
    }) as HTMLButtonElement;

    expect(inviteButton.disabled).toBe(true);
    expect(inviteButton.getAttribute("aria-describedby")).toBe(
      "team-actions-unavailable",
    );
  });

  it("disables member Edit controls instead of leaving inert enabled buttons", () => {
    render(<TeamTab />);

    const editButtons = screen.getAllByRole("button", {
      name: /Edit .* unavailable/,
    }) as HTMLButtonElement[];

    expect(editButtons.length).toBeGreaterThan(0);
    for (const editButton of editButtons) {
      expect(editButton.disabled).toBe(true);
      expect(editButton.getAttribute("aria-describedby")).toBe(
        "team-actions-unavailable",
      );
    }
  });

  it("renders the signed-in user as the sole member row instead of mock seeds", () => {
    render(<TeamTab />);

    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("ada@example.com")).toBeDefined();
    expect(screen.queryByText(/ashley@example\.com/i)).toBeNull();
    expect(screen.queryByText(/jaeyun@example\.com/i)).toBeNull();
  });
});
