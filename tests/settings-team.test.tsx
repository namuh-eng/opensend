// ABOUTME: Unit tests for the Settings Team tab — live workspace member actions and manual invite path

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const mockFetch = vi.fn<typeof fetch>();

global.fetch = mockFetch;

function teamResponse() {
  return {
    object: "list",
    workspace: {
      id: "workspace-1",
      name: "Ada's Workspace",
      owner_user_id: "user-1",
      role: "owner",
    },
    data: [
      {
        id: "user-1",
        membership_id: "membership-owner",
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "owner",
        created_at: "2026-06-08T12:00:00.000Z",
      },
      {
        id: "user-2",
        membership_id: "membership-member",
        name: "Grace Hopper",
        email: "grace@example.com",
        role: "member",
        created_at: "2026-06-08T12:00:00.000Z",
      },
    ],
    invitations: [
      {
        id: "invite-1",
        email: "pending@example.com",
        role: "member",
        status: "pending",
        expires_at: "2026-06-15T12:00:00.000Z",
        created_at: "2026-06-08T12:00:00.000Z",
        accepted_at: null,
        revoked_at: null,
      },
    ],
  };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(jsonResponse(teamResponse()));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TeamTab", () => {
  it("loads live workspace members and enables owner invite controls", async () => {
    render(<TeamTab />);

    expect(await screen.findByText("Ada's Workspace")).toBeDefined();
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("Grace Hopper")).toBeDefined();
    expect(screen.getByText("pending@example.com")).toBeDefined();

    const inviteEmail = screen.getByLabelText(
      "Invite email",
    ) as HTMLInputElement;
    expect(inviteEmail.disabled).toBe(false);
    expect(
      screen.getByText(/Invitation email delivery is not automatic/),
    ).toBeDefined();
    expect(screen.queryByText(/not available in OpenSend yet/)).toBeNull();
  });

  it("posts an invitation and displays the one-time manual token", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(async (input, init) => {
      if (input === "/api/invites" && init?.method === "POST") {
        return jsonResponse(
          {
            id: "invite-created",
            email: "new@example.com",
            role: "member",
            status: "pending",
            expires_at: "2026-06-15T12:00:00.000Z",
            created_at: "2026-06-08T12:00:00.000Z",
            accepted_at: null,
            revoked_at: null,
            token: "manual-token-123",
          },
          { status: 201 },
        );
      }
      return jsonResponse(teamResponse());
    });

    render(<TeamTab />);
    await screen.findByText("Ada's Workspace");

    await user.type(screen.getByLabelText("Invite email"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Invite member" }));

    expect(await screen.findByText("manual-token-123")).toBeDefined();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/invites",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders role and removal controls for editable non-owner members", async () => {
    render(<TeamTab />);

    const roleSelect = (await screen.findByLabelText(
      "Role for grace@example.com",
    )) as HTMLSelectElement;
    expect(roleSelect.value).toBe("member");

    const saveButton = screen.getByRole("button", {
      name: "Save role for grace@example.com",
    }) as HTMLButtonElement;
    const removeButton = screen.getByRole("button", {
      name: "Remove grace@example.com",
    }) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
    expect(removeButton.disabled).toBe(false);
  });
});
