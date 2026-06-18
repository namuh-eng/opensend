import { createE2ETenant, expect, getE2EBaseUrl, test } from "./fixtures/auth";

function sessionCookie(signedSessionToken: string): string {
  return `better-auth.session_token=${signedSessionToken}`;
}

test.describe("workspace role enforcement on API key management", () => {
  test("denies members, allows admins, and blocks non-member tenant access with real session and DB rows", async ({
    authenticatedPage: page,
    e2eDb,
    e2eRunId,
    e2eTenant,
    playwright,
  }) => {
    const ownerRequest = page.request;
    const memberTenant = await createE2ETenant(e2eDb, e2eRunId, "member");
    const outsiderTenant = await createE2ETenant(e2eDb, e2eRunId, "outsider");

    const inviteResponse = await ownerRequest.post("/api/invites", {
      data: { email: memberTenant.user.email, role: "member" },
    });
    expect(inviteResponse.status()).toBe(201);
    const invite = (await inviteResponse.json()) as {
      id: string;
      token: string;
    };
    expect(invite.token).toEqual(expect.any(String));

    const memberRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Cookie: sessionCookie(memberTenant.user.signedSessionToken),
      },
    });
    const outsiderRequest = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Cookie: sessionCookie(outsiderTenant.user.signedSessionToken),
      },
    });

    try {
      const acceptResponse = await memberRequest.post("/api/invites/accept", {
        data: { token: invite.token },
      });
      expect(acceptResponse.status()).toBe(200);

      const workspaceRows = await e2eDb.query<{ workspace_id: string }>(
        `select workspace_id
         from workspace_memberships
         where user_id = $1`,
        [memberTenant.user.id],
      );
      const workspaceId = workspaceRows.rows[0]?.workspace_id;
      expect(workspaceId).toEqual(expect.any(String));

      const ownerLowerRoleInviteResponse = await ownerRequest.post(
        "/api/invites",
        {
          data: { email: e2eTenant.user.email, role: "member" },
        },
      );
      expect(ownerLowerRoleInviteResponse.status()).toBe(201);
      const ownerLowerRoleInvite =
        (await ownerLowerRoleInviteResponse.json()) as {
          token: string;
        };

      const ownerAcceptResponse = await ownerRequest.post(
        "/api/invites/accept",
        {
          data: { token: ownerLowerRoleInvite.token },
        },
      );
      expect(ownerAcceptResponse.status()).toBe(200);
      await expect(ownerAcceptResponse.json()).resolves.toMatchObject({
        membership: {
          user_id: e2eTenant.user.id,
          role: "owner",
        },
      });

      const ownerMembershipRows = await e2eDb.query<{ role: string }>(
        `select role
         from workspace_memberships
         where workspace_id = $1 and user_id = $2`,
        [workspaceId, e2eTenant.user.id],
      );
      expect(ownerMembershipRows.rows).toEqual([{ role: "owner" }]);

      const memberCreate = await memberRequest.post("/api/api-keys", {
        headers: { "x-opensend-workspace-id": workspaceId },
        data: {
          name: `member-${e2eRunId.slice(0, 24)}`,
          permission: "full_access",
        },
      });
      expect(memberCreate.status()).toBe(403);
      await expect(memberCreate.json()).resolves.toEqual({
        error:
          "Your workspace role does not have permission to access this resource.",
      });

      await e2eDb.query(
        `update workspace_memberships
         set role = 'admin', updated_at = now()
         where workspace_id = $1 and user_id = $2`,
        [workspaceId, memberTenant.user.id],
      );

      const adminCreate = await memberRequest.post("/api/api-keys", {
        headers: { "x-opensend-workspace-id": workspaceId },
        data: {
          name: `admin-${e2eRunId.slice(0, 24)}`,
          permission: "full_access",
        },
      });
      expect(adminCreate.status()).toBe(201);
      const created = (await adminCreate.json()) as {
        id: string;
        token: string;
      };
      expect(created.id).toEqual(expect.any(String));
      expect(created.token).toEqual(expect.any(String));

      const createdRows = await e2eDb.query<{ user_id: string }>(
        "select user_id from api_keys where id = $1",
        [created.id],
      );
      expect(createdRows.rows).toEqual([{ user_id: e2eTenant.user.id }]);

      const outsiderList = await outsiderRequest.get(
        "/api/api-keys?limit=100",
        {
          headers: { "x-opensend-workspace-id": workspaceId },
        },
      );
      expect(outsiderList.status()).toBe(403);
    } finally {
      await memberRequest.dispose();
      await outsiderRequest.dispose();
    }
  });
});
