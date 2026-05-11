import * as core from "@opensend/core";
import type {
  AuditAction,
  AuditActorInput,
  AuditSource,
  AuditTargetType,
  RecordAuditEventInput,
} from "@opensend/core";

type SessionLike = {
  user?: {
    id?: string | null;
    email?: string | null;
  } | null;
} | null;

export type AuditContext = {
  userId: string;
  actor: AuditActorInput;
  source: AuditSource;
  sourceApiKeyId?: string | null;
};

export function auditContextForApiKey(input: {
  userId: string;
  apiKeyId: string;
}): AuditContext {
  return {
    userId: input.userId,
    actor: { type: "api_key", id: input.apiKeyId },
    source: "api_key",
    sourceApiKeyId: input.apiKeyId,
  };
}

export function auditContextForDashboardSession(
  session: SessionLike,
): AuditContext | null {
  const userId = session?.user?.id;
  if (!userId) return null;

  return {
    userId,
    actor: {
      type: "user",
      id: userId,
      email: session.user?.email ?? null,
    },
    source: "dashboard",
    sourceApiKeyId: null,
  };
}

export async function recordAuditEvent(input: {
  context: AuditContext;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: unknown;
}): Promise<void> {
  if (!("auditEventService" in core)) return;

  try {
    await core.auditEventService.recordEvent({
      userId: input.context.userId,
      actor: input.context.actor,
      source: input.context.source,
      sourceApiKeyId: input.context.sourceApiKeyId,
      action: input.action,
      target: {
        type: input.targetType,
        id: input.targetId,
      },
      metadata: input.metadata,
    } satisfies RecordAuditEventInput);
  } catch (error) {
    console.error("Failed to record audit event:", error);
  }
}
