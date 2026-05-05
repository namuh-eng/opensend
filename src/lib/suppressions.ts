import { publicApiError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import {
  type SuppressionReason,
  type SuppressionSourceMetadata,
  emailSuppressions,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export type SuppressionRecord = typeof emailSuppressions.$inferSelect;

export type SuppressedRecipient = {
  email: string;
  reason: SuppressionReason;
  suppressedAt: Date;
};

export function normalizeSuppressionEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findSuppressedRecipients(input: {
  userId: string | null | undefined;
  recipients: string[];
}): Promise<SuppressedRecipient[]> {
  if (!input.userId || input.recipients.length === 0) return [];

  const normalized = [
    ...new Set(input.recipients.map(normalizeSuppressionEmail)),
  ];
  const records = await db
    .select({
      email: emailSuppressions.email,
      reason: emailSuppressions.reason,
      suppressedAt: emailSuppressions.suppressedAt,
    })
    .from(emailSuppressions)
    .where(
      and(
        eq(emailSuppressions.userId, input.userId),
        inArray(emailSuppressions.email, normalized),
      ),
    );

  return records;
}

export function suppressedRecipientError(
  suppressed: SuppressedRecipient[],
  statusCode = 422,
) {
  const first = suppressed[0];
  return publicApiError(
    "recipient_suppressed",
    first
      ? `Recipient ${first.email} is suppressed because it ${first.reason === "bounced" ? "bounced" : "complained"}. Remove the suppression before sending again.`
      : "One or more recipients are suppressed.",
    statusCode,
    {
      recipients: suppressed.map((entry) => entry.email).join(","),
      reason: first?.reason ?? null,
      scope: "user",
    },
  );
}

export async function listSuppressions(input: {
  userId: string;
  limit: number;
  after?: string;
}) {
  const conditions = [eq(emailSuppressions.userId, input.userId)];
  if (input.after) {
    conditions.push(sql`${emailSuppressions.id} < ${input.after}`);
  }

  const rows = await db
    .select()
    .from(emailSuppressions)
    .where(and(...conditions))
    .orderBy(desc(emailSuppressions.updatedAt))
    .limit(input.limit + 1);

  return {
    data: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
}

export async function removeSuppression(input: {
  userId: string;
  email: string;
}) {
  const [removed] = await db
    .delete(emailSuppressions)
    .where(
      and(
        eq(emailSuppressions.userId, input.userId),
        eq(emailSuppressions.email, normalizeSuppressionEmail(input.email)),
      ),
    )
    .returning({ id: emailSuppressions.id });
  return removed ?? null;
}

export type SuppressionResponse = {
  id: string;
  object: "suppression";
  email: string;
  reason: SuppressionReason;
  scope: "user";
  source_event_id: string | null;
  source_email_id: string | null;
  source_message_id: string | null;
  metadata: SuppressionSourceMetadata | null;
  suppressed_at: string;
  updated_at: string;
};

export function serializeSuppression(
  suppression: SuppressionRecord,
): SuppressionResponse {
  return {
    id: suppression.id,
    object: "suppression",
    email: suppression.email,
    reason: suppression.reason,
    scope: "user",
    source_event_id: suppression.sourceEventId,
    source_email_id: suppression.sourceEmailId,
    source_message_id: suppression.sourceMessageId,
    metadata: suppression.metadata ?? null,
    suppressed_at: suppression.suppressedAt.toISOString(),
    updated_at: suppression.updatedAt.toISOString(),
  };
}
