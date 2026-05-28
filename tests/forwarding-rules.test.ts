import { describe, expect, it, vi } from "vitest";
import type { ForwardingRuleWithRoute } from "../packages/core/src/db/repositories/forwardingRuleRepo";
import type {
  forwardingAttempts,
  forwardingRules,
  receivedEmails,
} from "../packages/core/src/db/schema";
import { EmailService } from "../packages/core/src/services/email";
import {
  type ForwardingAttemptRepository,
  type ForwardingRouteRepository,
  type ForwardingRuleRepository,
  type ForwardingRuleServiceError,
  assertNoForwardingLoop,
  createForwardingRuleService,
  findForwardingLoopViolation,
} from "../packages/core/src/services/forwardingRules";

type ForwardingRuleRow = typeof forwardingRules.$inferSelect;
type ForwardingAttemptRow = typeof forwardingAttempts.$inferSelect;
type ReceivedEmailRow = typeof receivedEmails.$inferSelect;

type RouteLookup = Awaited<
  ReturnType<ForwardingRouteRepository["findByIdForUser"]>
>;

const baseDate = new Date("2026-05-28T00:00:00.000Z");

function routeLookup(
  overrides: Partial<NonNullable<RouteLookup>> = {},
): NonNullable<RouteLookup> {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "user-1",
    domainId: "11111111-1111-4111-8111-111111111111",
    type: "exact",
    localPart: "support",
    targetLocalPart: "support",
    createdAt: baseDate,
    updatedAt: baseDate,
    domainName: "inbound.example.com",
    domainStatus: "verified",
    domainCapabilities: [{ name: "receiving", enabled: true }],
    ...overrides,
  };
}

function forwardingRule(
  overrides: Partial<ForwardingRuleWithRoute> = {},
): ForwardingRuleWithRoute {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    userId: "user-1",
    domainId: "11111111-1111-4111-8111-111111111111",
    routeId: "22222222-2222-4222-8222-222222222222",
    destinations: ["ops@example.net"],
    status: "active",
    invalidReason: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    domainName: "inbound.example.com",
    routeType: "exact",
    routeLocalPart: "support",
    routeTargetLocalPart: "support",
    ...overrides,
  };
}

function receivedEmail(
  overrides: Partial<ReceivedEmailRow> = {},
): ReceivedEmailRow {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    from: "sender@example.org",
    to: ["support@inbound.example.com"],
    subject: "Need help",
    html: "<p>Hello</p>",
    text: "Hello",
    status: "received",
    routeDecisions: [
      {
        recipient: "support@inbound.example.com",
        status: "exact",
        domainId: "11111111-1111-4111-8111-111111111111",
        routeId: "22222222-2222-4222-8222-222222222222",
        routeType: "exact",
        localPart: "support",
        targetAddress: "support@inbound.example.com",
      },
    ],
    attachments: [],
    headers: null,
    replyMatchStatus: "unmatched",
    threadId: null,
    replyToEmailId: null,
    contactId: null,
    createdAt: baseDate,
    userId: "user-1",
    ...overrides,
  };
}

function createAttempt(
  overrides: Partial<ForwardingAttemptRow> = {},
): ForwardingAttemptRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    userId: "user-1",
    ruleId: "33333333-3333-4333-8333-333333333333",
    receivedEmailId: "44444444-4444-4444-8444-444444444444",
    forwardedEmailId: null,
    status: "skipped",
    reason: "rule_disabled",
    destinations: ["ops@example.net"],
    providerMessageId: null,
    retryEligible: false,
    errorCode: null,
    errorMessage: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function ruleRepositoryWith(options: {
  route?: NonNullable<RouteLookup>;
  existingRule?: ForwardingRuleWithRoute;
  processRules?: ForwardingRuleWithRoute[];
  create?: ForwardingRuleRepository["create"];
}): {
  ruleRepository: ForwardingRuleRepository;
  routeRepository: ForwardingRouteRepository;
} {
  const createdRule = forwardingRule();
  return {
    routeRepository: {
      findByIdForUser: vi.fn(async () => options.route),
    },
    ruleRepository: {
      listForUser: vi.fn(async () =>
        options.existingRule ? [options.existingRule] : [],
      ),
      listForRouteIds: vi.fn(async () => options.processRules ?? []),
      findByIdForUser: vi.fn(async () => options.existingRule),
      findByRouteIdForUser: vi.fn(async () => options.existingRule),
      create:
        options.create ??
        vi.fn(async (data) => ({
          ...createdRule,
          ...data,
          id: createdRule.id,
          createdAt: baseDate,
          updatedAt: baseDate,
        })),
      update: vi.fn(async () => createdRule),
      delete: vi.fn(async (id) => ({ id })),
    },
  };
}

function attemptRepository(): ForwardingAttemptRepository {
  return {
    create: vi.fn(async (data) => createAttempt({ ...data })),
    listRecentForUser: vi.fn(async () => []),
    listForReceivedEmail: vi.fn(async () => []),
  };
}

describe("forwarding rule validation and loop prevention", () => {
  it("normalizes and deduplicates destination addresses", async () => {
    const create = vi.fn<ForwardingRuleRepository["create"]>(async (data) => ({
      ...forwardingRule(),
      ...data,
      createdAt: baseDate,
      updatedAt: baseDate,
    }));
    const repos = ruleRepositoryWith({ route: routeLookup(), create });
    const service = createForwardingRuleService({
      ...repos,
      attemptRepository: attemptRepository(),
    });

    await expect(
      service.createRule({
        userId: "user-1",
        routeId: "22222222-2222-4222-8222-222222222222",
        destinations: [" Ops@Example.NET ", "ops@example.net"],
      }),
    ).resolves.toMatchObject({ destinations: ["ops@example.net"] });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ destinations: ["ops@example.net"] }),
    );
  });

  it("rejects syntactically invalid destinations", async () => {
    const repos = ruleRepositoryWith({ route: routeLookup() });
    const service = createForwardingRuleService({
      ...repos,
      attemptRepository: attemptRepository(),
    });

    await expect(
      service.createRule({
        userId: "user-1",
        routeId: "22222222-2222-4222-8222-222222222222",
        destinations: ["not-an-email"],
      }),
    ).rejects.toMatchObject({
      code: "invalid_destinations",
      name: "ForwardingRuleServiceError",
    } satisfies Partial<ForwardingRuleServiceError>);
  });

  it("blocks forwarding loops to the same receiving domain or address", async () => {
    expect(
      findForwardingLoopViolation({
        destinations: ["support@inbound.example.com"],
        receivingDomain: "inbound.example.com",
        routeTargetAddress: "support@inbound.example.com",
        matchedRecipient: "support@inbound.example.com",
      }),
    ).toBe("support@inbound.example.com");

    expect(() =>
      assertNoForwardingLoop({
        destinations: ["other@inbound.example.com"],
        receivingDomain: "inbound.example.com",
        routeTargetAddress: "support@inbound.example.com",
      }),
    ).toThrowError(/same receiving domain/);

    const repos = ruleRepositoryWith({ route: routeLookup() });
    const service = createForwardingRuleService({
      ...repos,
      attemptRepository: attemptRepository(),
    });
    await expect(
      service.createRule({
        userId: "user-1",
        routeId: "22222222-2222-4222-8222-222222222222",
        destinations: ["loop@inbound.example.com"],
      }),
    ).rejects.toMatchObject({ code: "loop_prevention" });
  });

  it("records skipped attempts for disabled rules without sending", async () => {
    const attempts = attemptRepository();
    const send = vi.spyOn(EmailService.prototype, "send");
    const service = createForwardingRuleService({
      ...ruleRepositoryWith({
        processRules: [forwardingRule({ status: "disabled" })],
      }),
      attemptRepository: attempts,
      sender: new EmailService(),
    });

    await expect(
      service.processReceivedEmail({ receivedEmail: receivedEmail() }),
    ).resolves.toEqual([
      expect.objectContaining({
        status: "skipped",
        reason: "rule_disabled",
      }),
    ]);
    expect(attempts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "skipped",
        reason: "rule_disabled",
        receivedEmailId: "44444444-4444-4444-8444-444444444444",
      }),
    );
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });
});
