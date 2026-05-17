import { describe, expect, it } from "vitest";
import {
  type InviteMemberRepository,
  createInvitesService,
} from "../packages/core/src/services/invites";

const createdAt = new Date("2026-05-10T12:00:00.000Z");

describe("invites service", () => {
  it("lists all users through the member repository using the existing Team member response shape", async () => {
    let calls = 0;
    const repository: InviteMemberRepository = {
      async listMembersForUser(userId: string) {
        calls += 1;
        return [
          {
            id: userId,
            name: "Ada Lovelace",
            email: "ada@example.com",
            createdAt,
          },
        ];
      },
    };

    const service = createInvitesService({ repository });
    const response = await service.listMembers("user-1");

    expect(calls).toBe(1);
    expect(response).toEqual({
      object: "list",
      data: [
        {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "admin",
          created_at: createdAt,
        },
      ],
    });
  });
});
