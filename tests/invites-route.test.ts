import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockHeaders = vi.hoisted(() => vi.fn());
const mockListWorkspaceMembers = vi.hoisted(() => vi.fn());
const mockCreateInvitation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@opensend/core", () => ({
  WorkspaceServiceError: class WorkspaceServiceError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "WorkspaceServiceError";
    }
  },
  workspaceService: {
    listWorkspaceMembers: mockListWorkspaceMembers,
    createInvitation: mockCreateInvitation,
  },
}));

const createdAt = new Date("2026-05-10T12:00:00.000Z");

async function importRoute() {
  return import("@/app/api/invites/route");
}

function request(path = "/api/invites") {
  return new Request(`http://localhost${path}`);
}

describe("invites route adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers({ cookie: "session=test" }));
    mockGetSession.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1", name: "Ada Lovelace" },
    });
    mockListWorkspaceMembers.mockResolvedValue({
      object: "list",
      data: [],
      invitations: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps dashboard session auth in the adapter and returns the service envelope", async () => {
    mockListWorkspaceMembers.mockResolvedValue({
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
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "owner",
          created_at: createdAt,
        },
      ],
      invitations: [],
    });

    const route = await importRoute();
    const response = await route.GET(request());

    expect(response.status).toBe(200);
    expect(mockHeaders).toHaveBeenCalledOnce();
    expect(mockGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(mockListWorkspaceMembers).toHaveBeenCalledWith({
      actorUserId: "user-1",
      actorName: "Ada Lovelace",
      workspaceId: null,
    });
    await expect(response.json()).resolves.toEqual({
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
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "owner",
          created_at: "2026-05-10T12:00:00.000Z",
        },
      ],
      invitations: [],
    });
  });

  it("returns the existing unauthorized response without calling the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const route = await importRoute();
    const response = await route.GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockListWorkspaceMembers).not.toHaveBeenCalled();
  });

  it("maps service failures through the workspace error adapter", async () => {
    const error = new Error("db down");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockListWorkspaceMembers.mockRejectedValue(error);

    const route = await importRoute();
    const response = await route.GET(
      request("/api/invites?workspace_id=workspace-1"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Workspace service error:",
      error,
    );
  });
});
