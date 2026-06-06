# Dashboard Teams

OpenSend includes a workspace foundation for hosted teams while preserving the existing self-hosted, single-user account model.

Each existing account gets a default workspace owned by that user. Owners can create expiring invitations, revoke pending invitations, manage roles, and access billing and all operational resources. Admins can manage operational resources such as API keys, domains, webhooks, suppressions, and exports, but cannot manage billing or transfer ownership. Members are limited to read/use access as product surfaces adopt workspace-aware permissions.

## Invitations

Authenticated dashboard sessions can use the first workspace invitation APIs:

- `GET /api/invites` lists workspace members and invitation records for the selected workspace.
- `POST /api/invites` creates an expiring invitation with `email`, optional `role` (`admin` or `member`), and optional `expires_at`.
- `DELETE /api/invites/{id}` revokes a pending invitation.
- `POST /api/invites/accept` accepts an invitation with a `token` for the signed-in user whose email matches the invitation.

The create response returns the raw invitation token once so self-hosted operators can deliver it through their own email or admin workflow. OpenSend stores only a hash of the token.

## Workspace selection

Dashboard-compatible operational APIs may accept `X-OpenSend-Workspace-Id` to act inside a workspace where the signed-in user is a member. Without that header, OpenSend uses the signed-in user's default workspace for backward compatibility.

The first enforced sensitive surface is API-key management. Owners and admins can manage API keys for a selected workspace; members and non-members receive a 403 response.

## Entitlements

Workspace entitlements are stored at the workspace level. Self-hosted deployments default to permissive checks when no entitlement row exists, so Stripe or hosted billing provider secrets are not required for local or self-hosted operation.
