import { eq } from "drizzle-orm";
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
  listMembersForUser(userId: string): Promise<InviteMemberRow[]>;
};

const inviteMemberRepository: InviteMemberRepository = {
  async listMembersForUser(userId: string) {
    // TODO: replace with a real org/membership join once multi-member orgs ship.
    // Until then, restrict the "Team" view to the calling user to prevent
    // cross-tenant disclosure (every authenticated session would otherwise see
    // every user in the database).
    return db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId));
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
    async listMembers(userId: string): Promise<InviteListResponse> {
      const members = await repository.listMembersForUser(userId);

      return {
        object: "list",
        data: members.map(toInviteMember),
      };
    },
  };
}

export const invitesService = createInvitesService();
