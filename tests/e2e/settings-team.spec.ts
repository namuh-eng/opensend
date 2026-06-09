import { createE2EUser, expect, test } from "./fixtures/auth";

test("owner invites, role-edits, removes, and blocks cross-tenant team access", async ({
  authenticatedPage: ownerPage,
  browser,
  e2eDb,
  e2eRunId,
  e2eUser: owner,
}) => {
  const invited = await createE2EUser(e2eDb, e2eRunId, "invited");
  const outsider = await createE2EUser(e2eDb, e2eRunId, "outsider");

  await ownerPage.goto("/settings");
  const baseUrl = new URL(ownerPage.url()).origin;
  await ownerPage.getByRole("button", { name: "Team" }).click();
  await expect(
    ownerPage.getByText("Invitation email delivery is not automatic"),
  ).toBeVisible();

  await ownerPage.getByLabel("Invite email").fill(invited.email);
  await ownerPage.getByLabel("Invite role").selectOption("member");
  await ownerPage.getByRole("button", { name: "Invite member" }).click();

  const tokenLocator = ownerPage
    .getByTestId("manual-invite-token")
    .locator(".font-mono");
  await expect(tokenLocator).toBeVisible();
  const token = (await tokenLocator.textContent())?.trim() ?? "";
  expect(token.length).toBeGreaterThan(20);

  const invitationRows = await e2eDb.query<{
    id: string;
    workspace_id: string;
  }>(
    "select id, workspace_id from workspace_invitations where email = $1 and status = 'pending'",
    [invited.email],
  );
  expect(invitationRows.rows).toHaveLength(1);
  const workspaceId = invitationRows.rows[0]?.workspace_id ?? "";
  expect(workspaceId).toBeTruthy();

  const invitedContext = await browser.newContext({ baseURL: baseUrl });
  try {
    await invitedContext.addCookies([
      {
        name: "better-auth.session_token",
        value: invited.signedSessionToken,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const invitedPage = await invitedContext.newPage();
    await invitedPage.goto("/settings");
    await invitedPage.getByRole("button", { name: "Team" }).click();
    await invitedPage.getByLabel("Invitation token").fill(token);
    await invitedPage
      .getByRole("button", { name: "Accept invitation" })
      .click();
    await expect(
      invitedPage.getByText(
        "Invitation accepted. Your workspace membership is active.",
      ),
    ).toBeVisible();
  } finally {
    await invitedContext.close();
  }

  const acceptedRows = await e2eDb.query<{ id: string; role: string }>(
    "select id, role from workspace_memberships where workspace_id = $1 and user_id = $2",
    [workspaceId, invited.id],
  );
  expect(acceptedRows.rows).toHaveLength(1);
  const invitedMembershipId = acceptedRows.rows[0]?.id ?? "";
  expect(acceptedRows.rows[0]?.role).toBe("member");

  await ownerPage.goto("/settings");
  await ownerPage.getByRole("button", { name: "Team" }).click();
  await expect(ownerPage.getByText(invited.email).first()).toBeVisible();
  await ownerPage.getByLabel(`Role for ${invited.email}`).selectOption("admin");
  await ownerPage
    .getByRole("button", { name: `Save role for ${invited.email}` })
    .click();
  await expect(
    ownerPage.getByText(`Updated ${invited.email} to Admin.`),
  ).toBeVisible();

  const adminRows = await e2eDb.query<{ role: string }>(
    "select role from workspace_memberships where id = $1",
    [invitedMembershipId],
  );
  expect(adminRows.rows[0]?.role).toBe("admin");

  const outsiderContext = await browser.newContext({ baseURL: baseUrl });
  try {
    await outsiderContext.addCookies([
      {
        name: "better-auth.session_token",
        value: outsider.signedSessionToken,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const outsiderRequest = outsiderContext.request;
    const crossTenantResponse = await outsiderRequest.delete(
      `/api/workspace-members/${invitedMembershipId}?workspace_id=${workspaceId}`,
    );
    expect(crossTenantResponse.status()).toBe(403);
  } finally {
    await outsiderContext.close();
  }

  await ownerPage
    .getByRole("button", { name: `Remove ${invited.email}` })
    .click();
  await expect(
    ownerPage.getByText(`Removed ${invited.email} from the workspace.`),
  ).toBeVisible();

  const remainingRows = await e2eDb.query<{ count: string }>(
    "select count(*)::text as count from workspace_memberships where id = $1",
    [invitedMembershipId],
  );
  expect(remainingRows.rows[0]?.count).toBe("0");

  const auditRows = await e2eDb.query<{ action: string }>(
    `select action from audit_events
     where user_id = $1
       and action in (
         'team.invitation.created',
         'team.invitation.accepted',
         'team.member.role_changed',
         'team.member.removed'
       )
     order by created_at asc`,
    [owner.id],
  );
  expect(auditRows.rows.map((row) => row.action)).toEqual([
    "team.invitation.created",
    "team.invitation.accepted",
    "team.member.role_changed",
    "team.member.removed",
  ]);
});
