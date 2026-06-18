import { emailAddressSchema } from "../contracts/send";
import {
  type ForwardingAttemptWithEmailStatus,
  type ForwardingRuleWithRoute,
  forwardingAttemptRepo,
  forwardingRuleRepo,
} from "../db/repositories/forwardingRuleRepo";
import { receivingRouteRepo } from "../db/repositories/receivingRouteRepo";
import type { forwardingRules, receivedEmails } from "../db/schema";
import { type EmailService, emailService } from "./email";
import { storageService } from "./storage";

export type ForwardingRuleStatus = "active" | "disabled" | "invalid";
export type ForwardingAttemptStatus = "queued" | "skipped" | "failed";
export type ForwardingAttemptReason =
  | "queued"
  | "rule_disabled"
  | "rule_invalid"
  | "loop_prevention"
  | "send_failed";

type ForwardingRuleRow = typeof forwardingRules.$inferSelect;
type ReceivedEmailRow = typeof receivedEmails.$inferSelect;

type ReceivedEmailRouteDecision = NonNullable<
  ReceivedEmailRow["routeDecisions"]
>[number];

type ReceivedEmailAttachment = NonNullable<
  ReceivedEmailRow["attachments"]
>[number];

export type ForwardingAttemptResponse = {
  object: "forwarding_attempt";
  id: string;
  rule_id: string | null;
  received_email_id: string;
  forwarded_email_id: string | null;
  status: ForwardingAttemptStatus;
  reason: ForwardingAttemptReason;
  destinations: string[];
  provider_message_id: string | null;
  retry_eligible: boolean;
  error_code: string | null;
  error_message: string | null;
  forwarded_email_status: string | null;
  created_at: Date;
};

export type ForwardingRuleResponse = {
  object: "forwarding_rule";
  id: string;
  domain_id: string;
  domain: string;
  route_id: string;
  route_type: string;
  route_local_part: string | null;
  route_target_address: string;
  destinations: string[];
  status: ForwardingRuleStatus;
  invalid_reason: string | null;
  last_attempt: ForwardingAttemptResponse | null;
  created_at: Date;
  updated_at: Date;
};

export type ForwardingRuleListResponse = {
  object: "list";
  data: ForwardingRuleResponse[];
};

export type CreateForwardingRuleInput = {
  userId: string;
  routeId: string;
  destinations: string[];
  status?: "active" | "disabled";
};

export type UpdateForwardingRuleInput = {
  userId: string;
  id: string;
  destinations?: string[];
  status?: "active" | "disabled";
};

export type ProcessForwardingInput = {
  receivedEmail: ReceivedEmailRow;
};

export type ForwardingRuleRepository = {
  listForUser(options: {
    userId: string;
    domainId?: string;
  }): Promise<ForwardingRuleWithRoute[]>;
  listForRouteIds(
    userId: string,
    routeIds: string[],
  ): Promise<ForwardingRuleWithRoute[]>;
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<ForwardingRuleWithRoute | undefined>;
  findByRouteIdForUser(
    routeId: string,
    userId: string,
  ): Promise<ForwardingRuleWithRoute | undefined>;
  create(data: typeof forwardingRules.$inferInsert): Promise<ForwardingRuleRow>;
  update(
    id: string,
    userId: string,
    data: Partial<typeof forwardingRules.$inferInsert>,
  ): Promise<ForwardingRuleRow | undefined>;
  delete(id: string, userId: string): Promise<{ id: string } | undefined>;
};

export type ForwardingAttemptRepository = {
  create(
    data: Parameters<typeof forwardingAttemptRepo.create>[0],
  ): ReturnType<typeof forwardingAttemptRepo.create>;
  listRecentForUser(options: {
    userId: string;
    limit: number;
  }): Promise<ForwardingAttemptWithEmailStatus[]>;
  listForReceivedEmail(
    userId: string,
    receivedEmailId: string,
  ): Promise<ForwardingAttemptWithEmailStatus[]>;
};

export type ForwardingRouteRepository = {
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<
    Awaited<ReturnType<typeof receivingRouteRepo.findByIdForUser>> | undefined
  >;
};

export type ForwardingRuleServiceDependencies = {
  ruleRepository?: ForwardingRuleRepository;
  attemptRepository?: ForwardingAttemptRepository;
  routeRepository?: ForwardingRouteRepository;
  sender?: EmailService;
  getPresignedUrl?: (key: string) => Promise<string>;
};

export type ForwardingRuleServiceErrorCode =
  | "route_not_found"
  | "rule_not_found"
  | "rule_conflict"
  | "invalid_destinations"
  | "loop_prevention"
  | "invalid_status";

export class ForwardingRuleServiceError extends Error {
  constructor(
    readonly code: ForwardingRuleServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ForwardingRuleServiceError";
  }
}

function parseEmailAddress(
  value: string,
): { normalized: string; localPart: string; domain: string } | null {
  const normalized = value.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return {
    normalized,
    localPart: normalized.slice(0, at),
    domain: normalized.slice(at + 1),
  };
}

function normalizeDestinations(destinations: string[]): string[] {
  const normalized: string[] = [];
  for (const destination of destinations) {
    const trimmed = destination.trim().toLowerCase();
    if (!emailAddressSchema.safeParse(trimmed).success) {
      throw new ForwardingRuleServiceError(
        "invalid_destinations",
        "Forwarding destinations must be valid email addresses",
      );
    }
    if (!normalized.includes(trimmed)) normalized.push(trimmed);
  }

  if (normalized.length === 0) {
    throw new ForwardingRuleServiceError(
      "invalid_destinations",
      "At least one forwarding destination is required",
    );
  }
  if (normalized.length > 25) {
    throw new ForwardingRuleServiceError(
      "invalid_destinations",
      "Forwarding rules support up to 25 destination addresses",
    );
  }
  return normalized;
}

function normalizeRuleStatus(value: string): ForwardingRuleStatus {
  if (value === "active" || value === "disabled" || value === "invalid") {
    return value;
  }
  throw new ForwardingRuleServiceError(
    "invalid_status",
    "Forwarding rule status must be active, disabled, or invalid",
  );
}

function normalizeMutableStatus(
  value: string | undefined,
): "active" | "disabled" | undefined {
  if (value === undefined) return undefined;
  if (value === "active" || value === "disabled") return value;
  throw new ForwardingRuleServiceError(
    "invalid_status",
    "Forwarding rule status must be active or disabled",
  );
}

function routeTargetAddress(route: {
  domainName: string;
  routeTargetLocalPart: string;
}): string {
  return `${route.routeTargetLocalPart}@${route.domainName}`.toLowerCase();
}

export function findForwardingLoopViolation(input: {
  destinations: string[];
  receivingDomain: string;
  routeTargetAddress: string;
  matchedRecipient?: string | null;
}): string | null {
  const receivingDomain = input.receivingDomain.trim().toLowerCase();
  const routeTarget = input.routeTargetAddress.trim().toLowerCase();
  const matchedRecipient = input.matchedRecipient?.trim().toLowerCase() ?? null;

  for (const destination of input.destinations) {
    const parsed = parseEmailAddress(destination);
    if (!parsed) return destination;
    if (parsed.normalized === routeTarget) return parsed.normalized;
    if (matchedRecipient && parsed.normalized === matchedRecipient) {
      return parsed.normalized;
    }
    if (parsed.domain === receivingDomain) return parsed.normalized;
  }

  return null;
}

export function assertNoForwardingLoop(input: {
  destinations: string[];
  receivingDomain: string;
  routeTargetAddress: string;
  matchedRecipient?: string | null;
}): void {
  const violation = findForwardingLoopViolation(input);
  if (violation) {
    throw new ForwardingRuleServiceError(
      "loop_prevention",
      `Forwarding destination ${violation} points back to the same receiving domain or address`,
    );
  }
}

function toAttemptResponse(
  attempt: ForwardingAttemptWithEmailStatus,
): ForwardingAttemptResponse {
  return {
    object: "forwarding_attempt",
    id: attempt.id,
    rule_id: attempt.ruleId,
    received_email_id: attempt.receivedEmailId,
    forwarded_email_id: attempt.forwardedEmailId,
    status: attempt.status as ForwardingAttemptStatus,
    reason: attempt.reason as ForwardingAttemptReason,
    destinations: attempt.destinations,
    provider_message_id: attempt.providerMessageId,
    retry_eligible: attempt.retryEligible,
    error_code: attempt.errorCode,
    error_message: attempt.errorMessage,
    forwarded_email_status: attempt.forwardedEmailStatus,
    created_at: attempt.createdAt,
  };
}

function toRuleResponse(
  rule: ForwardingRuleWithRoute,
  lastAttempt: ForwardingAttemptWithEmailStatus | null,
): ForwardingRuleResponse {
  return {
    object: "forwarding_rule",
    id: rule.id,
    domain_id: rule.domainId,
    domain: rule.domainName,
    route_id: rule.routeId,
    route_type: rule.routeType,
    route_local_part: rule.routeLocalPart,
    route_target_address: routeTargetAddress(rule),
    destinations: rule.destinations,
    status: normalizeRuleStatus(rule.status),
    invalid_reason: rule.invalidReason,
    last_attempt: lastAttempt ? toAttemptResponse(lastAttempt) : null,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

function latestAttemptByRule(
  attempts: ForwardingAttemptWithEmailStatus[],
): Map<string, ForwardingAttemptWithEmailStatus> {
  const map = new Map<string, ForwardingAttemptWithEmailStatus>();
  for (const attempt of attempts) {
    if (attempt.ruleId && !map.has(attempt.ruleId)) {
      map.set(attempt.ruleId, attempt);
    }
  }
  return map;
}

function routeIdsFromReceivedEmail(email: ReceivedEmailRow): string[] {
  const ids: string[] = [];
  for (const decision of email.routeDecisions ?? []) {
    if (decision.routeId && !ids.includes(decision.routeId))
      ids.push(decision.routeId);
  }
  return ids;
}

function matchedDecisionForRule(
  email: ReceivedEmailRow,
  rule: ForwardingRuleWithRoute,
): ReceivedEmailRouteDecision | null {
  return (
    email.routeDecisions?.find(
      (decision) => decision.routeId === rule.routeId,
    ) ?? null
  );
}

function summarizeSendError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return {
      code: error.name || "send_failed",
      message: error.message.slice(0, 1_000),
    };
  }
  return { code: "send_failed", message: "Forwarding send failed" };
}

function forwardingSubject(subject: string): string {
  return /^fwd?:/i.test(subject) ? subject : `Fwd: ${subject}`;
}

function forwardingHtml(email: ReceivedEmailRow): string | undefined {
  if (email.html) return email.html;
  if (!email.text) return undefined;
  const escaped = email.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre>${escaped}</pre>`;
}

async function forwardingAttachments(
  attachments: ReceivedEmailAttachment[] | null,
  getPresignedUrl: (key: string) => Promise<string>,
) {
  if (!attachments || attachments.length === 0) return undefined;
  const mapped = [];
  for (const attachment of attachments) {
    mapped.push({
      filename: attachment.filename,
      path: await getPresignedUrl(attachment.s3Key),
      content_type: attachment.contentType,
    });
  }
  return mapped;
}

export function createForwardingRuleService({
  ruleRepository = forwardingRuleRepo,
  attemptRepository = forwardingAttemptRepo,
  routeRepository = receivingRouteRepo,
  sender = emailService,
  getPresignedUrl = storageService.getPresignedUrl.bind(storageService),
}: ForwardingRuleServiceDependencies = {}) {
  async function getLastAttempts(userId: string) {
    return latestAttemptByRule(
      await attemptRepository.listRecentForUser({ userId, limit: 250 }),
    );
  }

  async function createSkippedAttempt(input: {
    rule: ForwardingRuleWithRoute;
    email: ReceivedEmailRow;
    reason: Exclude<ForwardingAttemptReason, "queued" | "send_failed">;
    message: string;
  }) {
    return await attemptRepository.create({
      userId: input.email.userId ?? input.rule.userId,
      ruleId: input.rule.id,
      receivedEmailId: input.email.id,
      status: "skipped",
      reason: input.reason,
      destinations: input.rule.destinations,
      retryEligible: false,
      errorCode: input.reason,
      errorMessage: input.message,
    });
  }

  return {
    async listRules(input: {
      userId: string;
      domainId?: string | null;
    }): Promise<ForwardingRuleListResponse> {
      const rules = await ruleRepository.listForUser({
        userId: input.userId,
        domainId: input.domainId ?? undefined,
      });
      const attempts = await getLastAttempts(input.userId);
      return {
        object: "list",
        data: rules.map((rule) =>
          toRuleResponse(rule, attempts.get(rule.id) ?? null),
        ),
      };
    },

    async createRule(
      input: CreateForwardingRuleInput,
    ): Promise<ForwardingRuleResponse> {
      const status = normalizeMutableStatus(input.status) ?? "active";
      const route = await routeRepository.findByIdForUser(
        input.routeId,
        input.userId,
      );
      if (!route) {
        throw new ForwardingRuleServiceError(
          "route_not_found",
          "Receiving route not found",
        );
      }
      const existing = await ruleRepository.findByRouteIdForUser(
        route.id,
        input.userId,
      );
      if (existing) {
        throw new ForwardingRuleServiceError(
          "rule_conflict",
          "A forwarding rule already exists for this receiving route",
        );
      }

      const destinations = normalizeDestinations(input.destinations);
      if (status === "active") {
        assertNoForwardingLoop({
          destinations,
          receivingDomain: route.domainName,
          routeTargetAddress: `${route.targetLocalPart}@${route.domainName}`,
        });
      }

      const created = await ruleRepository.create({
        userId: input.userId,
        domainId: route.domainId,
        routeId: route.id,
        destinations,
        status,
        invalidReason: null,
      });

      return toRuleResponse(
        {
          ...created,
          domainName: route.domainName,
          routeType: route.type,
          routeLocalPart: route.localPart,
          routeTargetLocalPart: route.targetLocalPart,
        },
        null,
      );
    },

    async updateRule(
      input: UpdateForwardingRuleInput,
    ): Promise<ForwardingRuleResponse> {
      const existing = await ruleRepository.findByIdForUser(
        input.id,
        input.userId,
      );
      if (!existing) {
        throw new ForwardingRuleServiceError(
          "rule_not_found",
          "Forwarding rule not found",
        );
      }
      const status =
        normalizeMutableStatus(input.status) ??
        normalizeRuleStatus(existing.status);
      const destinations = input.destinations
        ? normalizeDestinations(input.destinations)
        : existing.destinations;
      if (status === "active") {
        assertNoForwardingLoop({
          destinations,
          receivingDomain: existing.domainName,
          routeTargetAddress: routeTargetAddress(existing),
        });
      }

      const updated = await ruleRepository.update(existing.id, input.userId, {
        destinations,
        status,
        invalidReason: null,
      });
      if (!updated) {
        throw new ForwardingRuleServiceError(
          "rule_not_found",
          "Forwarding rule not found",
        );
      }
      const attempts = await getLastAttempts(input.userId);
      return toRuleResponse(
        {
          ...updated,
          domainName: existing.domainName,
          routeType: existing.routeType,
          routeLocalPart: existing.routeLocalPart,
          routeTargetLocalPart: existing.routeTargetLocalPart,
        },
        attempts.get(existing.id) ?? null,
      );
    },

    async deleteRule(
      id: string,
      userId: string,
    ): Promise<{ object: "forwarding_rule"; id: string; deleted: true }> {
      const deleted = await ruleRepository.delete(id, userId);
      if (!deleted) {
        throw new ForwardingRuleServiceError(
          "rule_not_found",
          "Forwarding rule not found",
        );
      }
      return { object: "forwarding_rule", id: deleted.id, deleted: true };
    },

    async listAttemptsForReceivedEmail(
      userId: string,
      receivedEmailId: string,
    ): Promise<{ object: "list"; data: ForwardingAttemptResponse[] }> {
      const attempts = await attemptRepository.listForReceivedEmail(
        userId,
        receivedEmailId,
      );
      return { object: "list", data: attempts.map(toAttemptResponse) };
    },

    async processReceivedEmail(
      input: ProcessForwardingInput,
    ): Promise<ForwardingAttemptResponse[]> {
      const userId = input.receivedEmail.userId;
      if (!userId) return [];
      const routeIds = routeIdsFromReceivedEmail(input.receivedEmail);
      const rules = await ruleRepository.listForRouteIds(userId, routeIds);
      const responses: ForwardingAttemptResponse[] = [];

      for (const rule of rules) {
        const status = normalizeRuleStatus(rule.status);
        const decision = matchedDecisionForRule(input.receivedEmail, rule);
        if (status === "disabled") {
          const attempt = await createSkippedAttempt({
            rule,
            email: input.receivedEmail,
            reason: "rule_disabled",
            message: "Forwarding rule is disabled",
          });
          responses.push(
            toAttemptResponse({ ...attempt, forwardedEmailStatus: null }),
          );
          continue;
        }
        if (status === "invalid") {
          const attempt = await createSkippedAttempt({
            rule,
            email: input.receivedEmail,
            reason: "rule_invalid",
            message: rule.invalidReason ?? "Forwarding rule is invalid",
          });
          responses.push(
            toAttemptResponse({ ...attempt, forwardedEmailStatus: null }),
          );
          continue;
        }

        const violation = findForwardingLoopViolation({
          destinations: rule.destinations,
          receivingDomain: rule.domainName,
          routeTargetAddress: routeTargetAddress(rule),
          matchedRecipient: decision?.recipient,
        });
        if (violation) {
          const attempt = await createSkippedAttempt({
            rule,
            email: input.receivedEmail,
            reason: "loop_prevention",
            message: `Forwarding destination ${violation} points back to the same receiving domain or address`,
          });
          responses.push(
            toAttemptResponse({ ...attempt, forwardedEmailStatus: null }),
          );
          continue;
        }

        try {
          const sent = await sender.send({
            from: routeTargetAddress(rule),
            to: rule.destinations,
            subject: forwardingSubject(input.receivedEmail.subject),
            html: forwardingHtml(input.receivedEmail),
            text: input.receivedEmail.text ?? undefined,
            replyTo: [input.receivedEmail.from],
            headers: {
              "X-OpenSend-Forwarded-Received-Email-ID": input.receivedEmail.id,
              "X-OpenSend-Forwarding-Rule-ID": rule.id,
              "X-Original-From": input.receivedEmail.from,
            },
            attachments: await forwardingAttachments(
              input.receivedEmail.attachments,
              getPresignedUrl,
            ),
            tags: [
              { name: "opensend_forward", value: "inbound" },
              { name: "received_email_id", value: input.receivedEmail.id },
            ],
            userId,
          });
          const attempt = await attemptRepository.create({
            userId,
            ruleId: rule.id,
            receivedEmailId: input.receivedEmail.id,
            forwardedEmailId: sent.id,
            status: "queued",
            reason: "queued",
            destinations: rule.destinations,
            providerMessageId: sent.providerId,
            retryEligible: true,
          });
          responses.push(
            toAttemptResponse({ ...attempt, forwardedEmailStatus: "queued" }),
          );
        } catch (error) {
          const summary = summarizeSendError(error);
          const attempt = await attemptRepository.create({
            userId,
            ruleId: rule.id,
            receivedEmailId: input.receivedEmail.id,
            status: "failed",
            reason: "send_failed",
            destinations: rule.destinations,
            retryEligible: true,
            errorCode: summary.code,
            errorMessage: summary.message,
          });
          responses.push(
            toAttemptResponse({ ...attempt, forwardedEmailStatus: null }),
          );
        }
      }

      return responses;
    },
  };
}

export const forwardingRuleService = createForwardingRuleService();
