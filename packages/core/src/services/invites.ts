import { db } from "../db/client";
import { user } from "../db/schema";

type UserRow = typeof user.$inferSelect;

export type InviteMemberRow = Pick<
  UserRow,
  "id" | "name" | "email" | "createdAt"
>;

export type InviteMember = {
  id: string;
  name: string;
  email: string;
  role: "admin";
  created_at: InviteMemberRow["createdAt"];
};

export type InviteListResponse = {
  object: "list";
  data: InviteMember[];
};

export type InviteMemberRepository = {
  listMembers(): Promise<InviteMemberRow[]>;
};

const inviteMemberRepository: InviteMemberRepository = {
  async listMembers() {
    // In a real multi-tenant setup, we'd filter by orgId.
    // For now, we return all users as a base implementation of the 'Team' view.
    return db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })
      .from(user);
  },
};

export type InvitesServiceDependencies = {
  repository?: InviteMemberRepository;
};

function toInviteMember(row: InviteMemberRow): InviteMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: "admin",
    created_at: row.createdAt,
  };
}

export function createInvitesService({
  repository = inviteMemberRepository,
}: InvitesServiceDependencies = {}) {
  return {
    async listMembers(): Promise<InviteListResponse> {
      const members = await repository.listMembers();

      return {
        object: "list",
        data: members.map(toInviteMember),
      };
    },
  };
}

export const invitesService = createInvitesService();
