import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  formatCustomEventDelivery,
  formatRunListItem,
} from "@/lib/automations";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { sendEventSchema } from "@/lib/validation/events";
import { resumeWaitingRunsForEvent } from "@/lib/workers/automation-runner";
import {
  AutomationValidationError,
  automationRepo,
  automationRunRepo,
  customEventDeliveryRepo,
} from "@opensend/core";
import { eq } from "drizzle-orm";

async function resolveContactId(input: {
  contactId?: string;
  email?: string;
  userId: string | null;
}): Promise<string | null> {
  if (input.contactId) return input.contactId;
  if (!input.email) return null;

  const normalizedEmail = input.email.toLowerCase().trim();
  const existing = await db.query.contacts.findFirst({
    where: eq(contacts.email, normalizedEmail),
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(contacts)
    .values({ email: normalizedEmail, userId: input.userId })
    .returning({ id: contacts.id });
  return created.id;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const event = parsed.data;
  const contactId = event.contact_id ?? event.contactId;

  try {
    const resolvedContactId = await resolveContactId({
      contactId,
      email: event.email,
      userId: auth.userId,
    });
    const delivery = await customEventDeliveryRepo.record({
      eventName: event.event,
      payload: event.payload ?? {},
      contactId: resolvedContactId,
      email: event.email?.toLowerCase().trim() ?? null,
      userId: auth.userId,
    });
    const resumedRuns = await resumeWaitingRunsForEvent(delivery);

    const matching = await automationRepo.findEnabledByTriggerEventName(
      event.event,
      auth.userId,
    );
    const runs = [];
    for (const automation of matching) {
      runs.push(
        await automationRunRepo.createFromTrigger({
          automationId: automation.id,
          triggerEventId: delivery.id,
          contactId: resolvedContactId,
          userId: auth.userId,
          initialStepKey: "trigger",
        }),
      );
    }

    return Response.json(
      {
        object: "event_delivery",
        delivery: formatCustomEventDelivery(delivery),
        resumed_runs: resumedRuns.map(formatRunListItem),
        automation_runs: runs.map(formatRunListItem),
      },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof AutomationValidationError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to send event";
    return Response.json({ error: message }, { status: 500 });
  }
}
