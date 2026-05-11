import { db } from "@/lib/db";
import { domains, emails } from "@/lib/db/schema";
import type { VerifiedEmailTrackingToken } from "@opensend/core";
import { and, eq } from "drizzle-orm";

export async function findTrackingContext(payload: VerifiedEmailTrackingToken) {
  const [email, domain] = await Promise.all([
    db.query.emails.findFirst({
      where: and(
        eq(emails.id, payload.emailId),
        eq(emails.userId, payload.userId),
      ),
    }),
    db.query.domains.findFirst({
      where: and(
        eq(domains.id, payload.domainId),
        eq(domains.userId, payload.userId),
      ),
    }),
  ]);

  if (!email || !domain) return null;
  if (payload.kind === "click" && !domain.trackClicks) return null;
  if (payload.kind === "open" && !domain.trackOpens) return null;
  return { email, domain };
}

export function getRequestMetadata(
  request: Request,
): Record<string, string | null> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  return {
    user_agent: request.headers.get("user-agent"),
    ip,
  };
}
