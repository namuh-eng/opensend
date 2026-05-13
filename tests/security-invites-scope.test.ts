import { createInvitesService } from "@opensend/core";
import { describe, expect, it, vi } from "vitest";

describe("invitesService tenant scope", () => {
  it("passes userId to the repository (no global listing)", async () => {
    const listMembersForUser = vi.fn(async (userId: string) => [
      {
        id: userId,
        name: "Self",
        email: "self@example.com",
        createdAt: new Date(),
      },
    ]);
    const svc = createInvitesService({
      repository: { listMembersForUser },
    });

    const result = await svc.listMembers("user_42");
    expect(listMembersForUser).toHaveBeenCalledWith("user_42");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("user_42");
  });

  it("returns only the rows the repository emitted for this userId", async () => {
    const listMembersForUser = vi.fn(async () => []);
    const svc = createInvitesService({
      repository: { listMembersForUser },
    });
    const result = await svc.listMembers("user_99");
    expect(result).toEqual({ object: "list", data: [] });
  });
});
