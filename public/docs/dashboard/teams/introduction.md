# Dashboard Teams

OpenSend includes a workspace team-management MVP for hosted and self-hosted workspaces while preserving the existing single-owner account model.

Each existing account gets a default workspace owned by that user. Owners can list workspace members, create expiring invitations, revoke pending invitations, change admin/member roles, and remove members. Admins can manage operational resources such as API keys, domains, webhooks, suppressions, and exports, but cannot invite teammates or edit roles. Members are limited to read/use access as product surfaces adopt workspace-aware permissions.

## Team tab

In **Settings → Team**, signed-in users can see the selected workspace, their own role, active members, and pending invitations.

Owners can:

- Invite a teammate by email as `member` or `admin`.
- Copy the one-time manual invitation token returned by the dashboard.
- Revoke a pending invitation.
- Change another member between `member` and `admin`.
- Remove another member from the workspace.

Owner assignment, ownership transfer, and owner self-removal are intentionally out of scope for this MVP. Non-owners see read-only member state and explanatory copy instead of enabled mutation controls.

## Invitations

Authenticated dashboard sessions can use the workspace invitation APIs:

- `GET /api/invites` lists workspace members and invitation records for the selected workspace.
- `POST /api/invites` creates an expiring invitation with `email`, optional `role` (`admin` or `member`), and optional `expires_at`.
- `DELETE /api/invites/{id}` revokes a pending invitation.
- `POST /api/invites/accept` accepts an invitation with a `token` for the signed-in user whose email matches the invitation.

The create response returns the raw invitation token once so self-hosted operators can deliver it through their own email or admin workflow. OpenSend stores only a hash of the token. OpenSend does not automatically send invitation email in this MVP.

## Role editing and removal

Authenticated dashboard owners can manage active members with workspace-scoped membership IDs:

- `PATCH /api/workspace-members/{membership_id}` with `{ "role": "admin" }` or `{ "role": "member" }` changes a non-owner member role.
- `DELETE /api/workspace-members/{membership_id}` removes another member from the workspace.

All member mutations enforce server-side workspace membership, owner-only permissions, cross-tenant membership scoping, and last-owner/self-removal guards. The dashboard UI is not the permission boundary.

## Audit events

OpenSend records dashboard audit events for:

- `team.invitation.created`
- `team.invitation.revoked`
- `team.invitation.accepted`
- `team.member.role_changed`
- `team.member.removed`

Audit rows are scoped to the workspace owner tenant while preserving the acting user identity in the actor fields.

## Workspace selection

Dashboard-compatible operational APIs may accept `X-OpenSend-Workspace-Id` to act inside a workspace where the signed-in user is a member. Without that header, OpenSend uses the signed-in user's default workspace for backward compatibility.

The first enforced sensitive surfaces are API-key management and Team settings. Owners and admins can manage API keys for a selected workspace; only owners can manage invitations and member roles. Members and non-members receive a 403 response.

## Entitlements

Workspace entitlements are stored at the workspace level. Self-hosted deployments default to permissive checks when no entitlement row exists, so Stripe or hosted billing provider secrets are not required for local or self-hosted operation.
