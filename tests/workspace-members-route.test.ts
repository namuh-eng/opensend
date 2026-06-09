import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockHeaders = vi.hoisted(() => vi.fn());
const mockUpdateMemberRole = vi.hoisted(() => vi.fn());
const mockRemoveMember = vi.hoisted(() => vi.fn());
const mockResolveWorkspaceContext = vi.hoisted(() => vi.fn());
const mockRecordAuditEvent = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/audit-events", () => ({
  recordAuditEvent: mockRecordAuditEvent,
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
    updateMemberRole: mockUpdateMemberRole,
    removeMember: mockRemoveMember,
    resolveWorkspaceContext: mockResolveWorkspaceContext,
  },
}));

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

async function importRoute() {
  return import("@/app/api/workspace-members/[id]/route");
}

describe("workspace member route adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers({ cookie: "session=test" }));
    mockGetSession.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "owner-1", name: "Ada", email: "ada@example.com" },
    });
    mockUpdateMemberRole.mockResolvedValue({
      membership_id: "member-1",
      workspace_id: "workspace-1",
      user_id: "user-2",
      role: "admin",
      created_at: new Date("2026-06-08T12:00:00.000Z"),
      updated_at: new Date("2026-06-08T12:00:00.000Z"),
    });
    mockRemoveMember.mockResolvedValue({
      membership_id: "member-1",
      workspace_id: "workspace-1",
      user_id: "user-2",
      role: "member",
      created_at: new Date("2026-06-08T12:00:00.000Z"),
      updated_at: new Date("2026-06-08T12:00:00.000Z"),
    });
    mockResolveWorkspaceContext.mockResolvedValue({
      workspaceId: "workspace-1",
      workspaceName: "Ada's Workspace",
      actorUserId: "owner-1",
      tenantUserId: "owner-1",
      role: "owner",
    });
  });

  it("keeps dashboard auth at the edge before role updates", async () => {
    const route = await importRoute();
    const response = await route.PATCH(
      request("/api/workspace-members/member-1?workspace_id=workspace-1", {
        method: "PATCH",
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ id: "member-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockUpdateMemberRole).toHaveBeenCalledWith({
      actorUserId: "owner-1",
      actorName: "Ada",
      workspaceId: "workspace-1",
      membershipId: "member-1",
      role: "admin",
    });
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "team.member.role_changed",
        targetType: "team",
        targetId: "member-1",
      }),
    );
  });

  it("returns 401 before mutation without a dashboard session", async () => {
    mockGetSession.mockResolvedValue(null);
    const route = await importRoute();
    const response = await route.DELETE(
      request("/api/workspace-members/member-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "member-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockRemoveMember).not.toHaveBeenCalled();
  });

  it("maps member-not-found service errors to 404 for cross-tenant-safe IDs", async () => {
    const { WorkspaceServiceError } = await import("@opensend/core");
    mockRemoveMember.mockRejectedValue(
      new WorkspaceServiceError(
        "member_not_found",
        "Workspace member not found",
      ),
    );
    const route = await importRoute();
    const response = await route.DELETE(
      request("/api/workspace-members/other", { method: "DELETE" }),
      { params: Promise.resolve({ id: "other" }) },
    );

    expect(response.status).toBe(404);
    expect(mockRecordAuditEvent).not.toHaveBeenCalled();
  });
});
