import { db } from "@/lib/db";
import {
  broadcasts,
  contacts,
  emails,
  segments,
  topics,
} from "@/lib/db/schema";
import {
  buildOneClickUnsubscribeHeaders,
  createUnsubscribeUrl,
  getPublicBaseUrl,
  replaceUnsubscribePlaceholder,
} from "@/lib/unsubscribe";
import { and, eq, lte, sql } from "drizzle-orm";

/**
 * processScheduledBroadcasts
 *
 * Scans for broadcasts with status 'queued' or 'scheduled' (with scheduledAt in the past).
 * Fills in the actual email fanout and updates status to 'sent'.
 */
export async function processScheduledBroadcasts() {
  const now = new Date();

  // 1. Find pending broadcasts
  const pending = await db
    .select()
    .from(broadcasts)
    .where(
      and(
        sql`${broadcasts.status} IN ('queued', 'scheduled')`,
        lte(broadcasts.scheduledAt, now),
      ),
    )
    .limit(5); // Process in small batches for fanout safety

  if (pending.length === 0) return { processed: 0 };

  let totalEmailsCreated = 0;

  for (const broadcast of pending) {
    try {
      // 2. Mark as 'sending' to prevent double-processing
      await db
        .update(broadcasts)
        .set({ status: "sending" })
        .where(eq(broadcasts.id, broadcast.id));

      // 3. Resolve audience contacts
      let targetContacts: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      }[] = [];

      if (broadcast.audienceId) {
        // Resolve segment contacts (naive JSON check for now)
        const [segment] = await db
          .select({ name: segments.name })
          .from(segments)
          .where(eq(segments.id, broadcast.audienceId))
          .limit(1);
        if (segment) {
          targetContacts = await db
            .select({
              id: contacts.id,
              email: contacts.email,
              firstName: contacts.firstName,
              lastName: contacts.lastName,
            })
            .from(contacts)
            .where(
              and(
                eq(contacts.unsubscribed, false),
                sql`${contacts.segments} ? ${segment.name}`,
              ),
            );
        }
      } else {
        // Fallback: send to all subscribed contacts if no segment specified
        targetContacts = await db
          .select({
            id: contacts.id,
            email: contacts.email,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
          })
          .from(contacts)
          .where(eq(contacts.unsubscribed, false));
      }

      // 4. Perform fanout (create individual email records)
      if (targetContacts.length > 0) {
        for (const contact of targetContacts) {
          let html = broadcast.html || "";
          let subject = broadcast.subject || "";

          // Simple variable replacement
          const vars = {
            FIRST_NAME: contact.firstName || "",
            LAST_NAME: contact.lastName || "",
            EMAIL: contact.email,
          };

          for (const [key, value] of Object.entries(vars)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
            html = html.replace(regex, value);
            subject = subject.replace(regex, value);
          }

          const unsubscribeUrl = createUnsubscribeUrl(
            contact.id,
            getPublicBaseUrl(),
          );
          html = replaceUnsubscribePlaceholder(html, unsubscribeUrl);
          const text = replaceUnsubscribePlaceholder(
            broadcast.text || "",
            unsubscribeUrl,
          );

          await db.insert(emails).values({
            from: broadcast.from || "system@opensend.com",
            to: [contact.email],
            subject,
            html,
            text,
            headers: buildOneClickUnsubscribeHeaders(unsubscribeUrl),
            status: "queued", // Worker will pick these up
            userId: broadcast.userId,
            topicId: broadcast.topicId,
            tags: [{ name: "broadcast_id", value: broadcast.id }],
          });

          totalEmailsCreated++;
        }
      }

      // 5. Mark broadcast as finished
      await db
        .update(broadcasts)
        .set({ status: "sent" })
        .where(eq(broadcasts.id, broadcast.id));
    } catch (err) {
      console.error(`Failed to process broadcast ${broadcast.id}:`, err);
      // Revert status to queued for retry
      await db
        .update(broadcasts)
        .set({ status: "queued" })
        .where(eq(broadcasts.id, broadcast.id));
    }
  }

  return {
    processed: pending.length,
    emailsCreated: totalEmailsCreated,
  };
}
