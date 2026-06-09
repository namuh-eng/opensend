"use client";

import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { StatusBadge } from "@/components/status-badge";
import { authClient } from "@/lib/auth-client";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type WorkspaceRole = "owner" | "admin" | "member";
type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

type TeamMember = {
  id: string;
  membership_id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
};

type TeamInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

type TeamWorkspace = {
  id: string;
  name: string;
  owner_user_id: string;
  role: WorkspaceRole;
};

type TeamResponse = {
  object: "list";
  workspace: TeamWorkspace;
  data: TeamMember[];
  invitations: TeamInvitation[];
};

type DraftRoles = Record<string, WorkspaceRole>;

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "member";
}

function isInvitationStatus(value: unknown): value is InvitationStatus {
  return (
    value === "pending" ||
    value === "accepted" ||
    value === "revoked" ||
    value === "expired"
  );
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function parseMember(value: unknown): TeamMember | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const role = record.role;
  if (!isWorkspaceRole(role)) return null;

  const id = readString(record, "id");
  const membershipId = readString(record, "membership_id");
  const email = readString(record, "email");
  if (!id || !membershipId || !email) return null;

  return {
    id,
    membership_id: membershipId,
    name: readString(record, "name"),
    email,
    role,
    created_at: readString(record, "created_at"),
  };
}

function parseInvitation(value: unknown): TeamInvitation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const role = record.role;
  const status = record.status;
  if (!isWorkspaceRole(role) || !isInvitationStatus(status)) return null;

  const id = readString(record, "id");
  const email = readString(record, "email");
  if (!id || !email) return null;

  return {
    id,
    email,
    role,
    status,
    expires_at: readString(record, "expires_at"),
    created_at: readString(record, "created_at"),
    accepted_at: readNullableString(record, "accepted_at"),
    revoked_at: readNullableString(record, "revoked_at"),
  };
}

function parseTeamResponse(value: unknown): TeamResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.object !== "list") return null;

  const workspaceRecord = record.workspace;
  if (
    !workspaceRecord ||
    typeof workspaceRecord !== "object" ||
    Array.isArray(workspaceRecord)
  ) {
    return null;
  }
  const workspace = workspaceRecord as Record<string, unknown>;
  const workspaceRole = workspace.role;
  if (!isWorkspaceRole(workspaceRole)) return null;

  const data = Array.isArray(record.data)
    ? record.data.map(parseMember).filter((member) => member !== null)
    : [];
  const invitations = Array.isArray(record.invitations)
    ? record.invitations
        .map(parseInvitation)
        .filter((invitation) => invitation !== null)
    : [];

  return {
    object: "list",
    workspace: {
      id: readString(workspace, "id"),
      name: readString(workspace, "name"),
      owner_user_id: readString(workspace, "owner_user_id"),
      role: workspaceRole,
    },
    data,
    invitations,
  };
}

function roleLabel(role: WorkspaceRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function workspaceUrl(path: string, workspaceId: string | null): string {
  if (!workspaceId) return path;
  const params = new URLSearchParams({ workspace_id: workspaceId });
  return `${path}?${params.toString()}`;
}

function labelFromString(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusVariant(status: InvitationStatus) {
  if (status === "pending") return "warning" as const;
  if (status === "accepted") return "success" as const;
  if (status === "revoked" || status === "expired") return "error" as const;
  return "default" as const;
}

function buttonClass(
  variant: "primary" | "secondary" | "danger" = "secondary",
) {
  const base =
    "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  if (variant === "primary") return `${base} bg-fg text-bg hover:bg-white`;
  if (variant === "danger")
    return `${base} border border-red-500/60 text-red-300 hover:bg-red-500/10`;
  return `${base} border border-line text-fg-2 hover:bg-white/[0.08] hover:text-fg`;
}

export function TeamTab() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const userId = user?.id ?? null;
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<WorkspaceRole, "owner">>("member");
  const [manualToken, setManualToken] = useState<string | null>(null);
  const [acceptToken, setAcceptToken] = useState("");
  const [draftRoles, setDraftRoles] = useState<DraftRoles>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const loadTeam = useCallback(
    async (workspaceId: string | null = null) => {
      if (!userId) return;
      setLoadingTeam(true);
      setError(null);
      try {
        const response = await fetch(workspaceUrl("/api/invites", workspaceId));
        if (!response.ok) {
          throw new Error("Could not load team members.");
        }
        const parsed = parseTeamResponse(await response.json());
        if (!parsed) throw new Error("Team response was not recognized.");
        setTeam(parsed);
        setDraftRoles(
          Object.fromEntries(
            parsed.data.map((member) => [member.membership_id, member.role]),
          ),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load team members.",
        );
      } finally {
        setLoadingTeam(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const canManageTeam = team?.workspace.role === "owner";
  const pendingInvitations = useMemo(
    () =>
      team?.invitations.filter((invite) => invite.status === "pending") ?? [],
    [team],
  );

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;

    setPendingAction("invite");
    setError(null);
    setMessage(null);
    setManualToken(null);
    try {
      const workspaceId = team?.workspace.id ?? null;
      const response = await fetch(workspaceUrl("/api/invites", workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        const record = body as Record<string, unknown>;
        throw new Error(
          typeof record.error === "string"
            ? record.error
            : "Could not create invitation.",
        );
      }
      const record = body as Record<string, unknown>;
      const token = readString(record, "token");
      setManualToken(token || null);
      setInviteEmail("");
      setMessage(
        "Invitation created. Copy the manual token and share it securely.",
      );
      await loadTeam(workspaceId);
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Could not create invitation.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptToken.trim()) return;

    setPendingAction("accept");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: acceptToken }),
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Could not accept invitation.",
        );
      }
      const membership =
        body.membership &&
        typeof body.membership === "object" &&
        !Array.isArray(body.membership)
          ? (body.membership as Record<string, unknown>)
          : null;
      const acceptedWorkspaceId =
        typeof membership?.workspace_id === "string"
          ? membership.workspace_id
          : null;
      setAcceptToken("");
      setMessage("Invitation accepted. Your workspace membership is active.");
      await loadTeam(acceptedWorkspaceId);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept invitation.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeInvitation(invitation: TeamInvitation) {
    setPendingAction(`revoke:${invitation.id}`);
    setError(null);
    setMessage(null);
    try {
      const workspaceId = team?.workspace.id ?? null;
      const response = await fetch(
        workspaceUrl(`/api/invites/${invitation.id}`, workspaceId),
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as Record<string, unknown>;
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Could not revoke invitation.",
        );
      }
      setMessage(`Revoked invitation for ${invitation.email}.`);
      await loadTeam(workspaceId);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Could not revoke invitation.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function saveRole(member: TeamMember) {
    const role = draftRoles[member.membership_id] ?? member.role;
    setPendingAction(`role:${member.membership_id}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        workspaceUrl(
          `/api/workspace-members/${member.membership_id}`,
          team?.workspace.id ?? null,
        ),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as Record<string, unknown>;
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Could not update role.",
        );
      }
      setMessage(`Updated ${member.email} to ${roleLabel(role)}.`);
      await loadTeam(team?.workspace.id ?? null);
    } catch (roleError) {
      setError(
        roleError instanceof Error
          ? roleError.message
          : "Could not update role.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function removeMember(member: TeamMember) {
    setPendingAction(`remove:${member.membership_id}`);
    setError(null);
    setMessage(null);
    try {
      const workspaceId = team?.workspace.id ?? null;
      const response = await fetch(
        workspaceUrl(
          `/api/workspace-members/${member.membership_id}`,
          workspaceId,
        ),
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as Record<string, unknown>;
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Could not remove member.",
        );
      }
      setMessage(`Removed ${member.email} from the workspace.`);
      await loadTeam(workspaceId);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove member.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (isPending) {
    return (
      <div className="rounded-lg border border-line p-6 text-[13px] text-fg-2">
        Loading session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-line p-6 text-[13px] text-fg-2">
        Sign in to view team members.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[14px] text-fg-2">
            View workspace members, invite teammates, and manage roles.
          </p>
          <p className="max-w-2xl text-[13px] text-fg-2">
            Invitation email delivery is not automatic in this MVP. Owners get a
            one-time manual token to share securely with the invited user.
          </p>
          {team ? (
            <p className="text-[12px] text-fg-3">
              Workspace:{" "}
              <span className="text-fg-2">{team.workspace.name}</span> · Your
              role:{" "}
              <span className="text-fg-2">
                {roleLabel(team.workspace.role)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-[13px] text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <output className="rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-[13px] text-green-200">
          {message}
        </output>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="space-y-3 rounded-lg border border-line bg-bg-card p-4"
          onSubmit={submitInvite}
        >
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Invite member</h2>
            <p className="mt-1 text-[12px] text-fg-2">
              Owners can invite admins or members. Owner invitations are out of
              scope.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <label className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-2">
                Email
              </span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={!canManageTeam || pendingAction === "invite"}
                placeholder="teammate@example.com"
                className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg outline-none focus:border-line-3 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Invite email"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-2">
                Role
              </span>
              <select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(
                    event.target.value === "admin" ? "admin" : "member",
                  )
                }
                disabled={!canManageTeam || pendingAction === "invite"}
                className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg outline-none focus:border-line-3 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Invite role"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={
              !canManageTeam ||
              !inviteEmail.trim() ||
              pendingAction === "invite"
            }
            className={buttonClass("primary")}
          >
            {pendingAction === "invite" ? "Inviting…" : "Invite member"}
          </button>
          {!canManageTeam ? (
            <p className="text-[12px] text-fg-2">
              Only workspace owners can invite teammates or edit roles.
            </p>
          ) : null}
          {manualToken ? (
            <div className="rounded-md border border-line bg-bg-3 p-3">
              <p className="mb-2 text-[12px] text-fg-2">
                Manual invitation token. It is shown once and should be shared
                securely.
              </p>
              <span data-testid="manual-invite-token">
                <CopyToClipboard value={manualToken} />
              </span>
            </div>
          ) : null}
        </form>

        <form
          className="space-y-3 rounded-lg border border-line bg-bg-card p-4"
          onSubmit={acceptInvitation}
        >
          <div>
            <h2 className="text-[15px] font-semibold text-fg">
              Accept invitation
            </h2>
            <p className="mt-1 text-[12px] text-fg-2">
              Paste a manual token sent by a workspace owner. Your signed-in
              email must match.
            </p>
          </div>
          <label className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-fg-2">
              Token
            </span>
            <input
              type="text"
              value={acceptToken}
              onChange={(event) => setAcceptToken(event.target.value)}
              disabled={pendingAction === "accept"}
              className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg outline-none focus:border-line-3 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Invitation token"
            />
          </label>
          <button
            type="submit"
            disabled={!acceptToken.trim() || pendingAction === "accept"}
            className={buttonClass("secondary")}
          >
            {pendingAction === "accept" ? "Accepting…" : "Accept invitation"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-bg-2">
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-fg-2">
                Member
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-fg-2">
                Role
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-fg-2">
                Status
              </th>
              <th className="px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {loadingTeam ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-[13px] text-fg-2"
                >
                  Loading team…
                </td>
              </tr>
            ) : team && team.data.length > 0 ? (
              team.data.map((member) => {
                const isSelf = member.id === user.id;
                const canEditMember =
                  canManageTeam && member.role !== "owner" && !isSelf;
                const draftRole =
                  draftRoles[member.membership_id] ?? member.role;
                const roleChanged = draftRole !== member.role;
                return (
                  <tr
                    key={member.membership_id}
                    className="border-b border-line transition-colors last:border-0 hover:bg-bg-2"
                  >
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium text-fg">
                          {member.name || member.email}
                        </span>
                        <span className="text-[12px] text-fg-2">
                          {member.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {canEditMember ? (
                        <select
                          value={draftRole}
                          onChange={(event) =>
                            setDraftRoles((current) => ({
                              ...current,
                              [member.membership_id]:
                                event.target.value === "admin"
                                  ? "admin"
                                  : "member",
                            }))
                          }
                          className="rounded-md border border-line bg-bg-3 px-2 py-1 text-[13px] text-fg outline-none focus:border-line-3"
                          aria-label={`Role for ${member.email}`}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="text-[13px] capitalize text-fg">
                          {roleLabel(member.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status="Active" variant="success" />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {canEditMember ? (
                          <>
                            <button
                              type="button"
                              disabled={
                                !roleChanged ||
                                pendingAction === `role:${member.membership_id}`
                              }
                              className={buttonClass("secondary")}
                              onClick={() => void saveRole(member)}
                            >
                              Save role for {member.email}
                            </button>
                            <button
                              type="button"
                              disabled={
                                pendingAction ===
                                `remove:${member.membership_id}`
                              }
                              className={buttonClass("danger")}
                              onClick={() => void removeMember(member)}
                            >
                              Remove {member.email}
                            </button>
                          </>
                        ) : (
                          <span className="text-[12px] text-fg-3">
                            {isSelf ? "Current user" : "Owner-managed"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-[13px] text-fg-2"
                >
                  No workspace members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <div className="border-b border-line bg-bg-2 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-fg">
            Pending invitations
          </h2>
        </div>
        {pendingInvitations.length > 0 ? (
          <div className="divide-y divide-line">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-[14px] font-medium text-fg">
                    {invitation.email}
                  </p>
                  <p className="text-[12px] text-fg-2">
                    {roleLabel(invitation.role)} · Expires{" "}
                    {invitation.expires_at || "on schedule"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge
                    status={labelFromString(invitation.status)}
                    variant={statusVariant(invitation.status)}
                  />
                  {canManageTeam ? (
                    <button
                      type="button"
                      className={buttonClass("danger")}
                      disabled={pendingAction === `revoke:${invitation.id}`}
                      onClick={() => void revokeInvitation(invitation)}
                    >
                      Revoke {invitation.email}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-fg-2">
            No pending invitations.
          </p>
        )}
      </div>
    </div>
  );
}
