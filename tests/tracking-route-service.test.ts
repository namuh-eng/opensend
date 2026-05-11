import {
  type TrackingRouteLookupRepository,
  createTrackingRouteService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type EmailRow = NonNullable<
  Awaited<ReturnType<TrackingRouteLookupRepository["findEmailByIdForUser"]>>
>;
type DomainRow = NonNullable<
  Awaited<ReturnType<TrackingRouteLookupRepository["findDomainByIdForUser"]>>
>;

function makeEmail(overrides: Partial<EmailRow> = {}): EmailRow {
  return {
    id: "email-1",
    from: "sender@example.com",
    to: ["person@example.com"],
    cc: null,
    bcc: null,
    replyTo: null,
    subject: "Hello",
    html: "<p>Hello</p>",
    text: null,
    status: "delivered",
    providerRetryCount: 0,
    providerLastAttemptedAt: null,
    providerNextRetryAt: null,
    providerLastErrorCode: null,
    providerLastErrorMessage: null,
    providerDeadLetteredAt: null,
    tags: null,
    headers: null,
    attachments: null,
    scheduledAt: null,
    sentAt: new Date("2026-01-01T00:00:05Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    document: null,
    userId: "user-1",
    topicId: null,
    idempotencyKey: null,
    ...overrides,
  };
}

function makeDomain(overrides: Partial<DomainRow> = {}): DomainRow {
  return {
    id: "domain-1",
    name: "example.com",
    status: "verified",
    region: "us-east-1",
    dkimTokens: null,
    records: null,
    trackClicks: true,
    trackOpens: true,
    tls: "opportunistic",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    document: null,
    userId: "user-1",
    customReturnPath: null,
    trackingSubdomain: null,
    capabilities: null,
    dkimOrigin: "AWS_SES",
    dkimSelector: null,
    dkimPublicKey: null,
    dkimPrivateKeyCt: null,
    dkimPrivateKeyIv: null,
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<TrackingRouteLookupRepository> = {},
): TrackingRouteLookupRepository {
  return {
    async findEmailByIdForUser() {
      return makeEmail();
    },
    async findDomainByIdForUser() {
      return makeDomain();
    },
    ...overrides,
  };
}

describe("tracking route service boundary", () => {
  it("looks up email and domain using token tenant scope", async () => {
    const captured: Array<{
      type: "email" | "domain";
      id: string;
      userId: string;
    }> = [];
    const service = createTrackingRouteService({
      repository: makeRepository({
        async findEmailByIdForUser(id, userId) {
          captured.push({ type: "email", id, userId });
          return makeEmail({ id, userId });
        },
        async findDomainByIdForUser(id, userId) {
          captured.push({ type: "domain", id, userId });
          return makeDomain({ id, userId });
        },
      }),
    });

    const result = await service.findTrackingContext({
      v: 1,
      kind: "click",
      userId: "user-2",
      emailId: "email-2",
      domainId: "domain-2",
      targetUrl: "https://destination.example.com",
    });

    expect(result).toMatchObject({
      email: { id: "email-2", userId: "user-2" },
      domain: { id: "domain-2", userId: "user-2" },
    });
    expect(captured).toEqual([
      { type: "email", id: "email-2", userId: "user-2" },
      { type: "domain", id: "domain-2", userId: "user-2" },
    ]);
  });

  it("returns null when the tenant-scoped email or domain is missing", async () => {
    const missingEmailService = createTrackingRouteService({
      repository: makeRepository({
        async findEmailByIdForUser() {
          return undefined;
        },
      }),
    });
    const missingDomainService = createTrackingRouteService({
      repository: makeRepository({
        async findDomainByIdForUser() {
          return undefined;
        },
      }),
    });

    await expect(
      missingEmailService.findTrackingContext({
        v: 1,
        kind: "open",
        userId: "user-1",
        emailId: "email-1",
        domainId: "domain-1",
      }),
    ).resolves.toBeNull();
    await expect(
      missingDomainService.findTrackingContext({
        v: 1,
        kind: "open",
        userId: "user-1",
        emailId: "email-1",
        domainId: "domain-1",
      }),
    ).resolves.toBeNull();
  });

  it("gates click and open contexts with the matching domain tracking toggle", async () => {
    const clickDisabledService = createTrackingRouteService({
      repository: makeRepository({
        async findDomainByIdForUser() {
          return makeDomain({ trackClicks: false, trackOpens: true });
        },
      }),
    });
    const openDisabledService = createTrackingRouteService({
      repository: makeRepository({
        async findDomainByIdForUser() {
          return makeDomain({ trackClicks: true, trackOpens: false });
        },
      }),
    });

    await expect(
      clickDisabledService.findTrackingContext({
        v: 1,
        kind: "click",
        userId: "user-1",
        emailId: "email-1",
        domainId: "domain-1",
        targetUrl: "https://destination.example.com",
      }),
    ).resolves.toBeNull();
    await expect(
      openDisabledService.findTrackingContext({
        v: 1,
        kind: "open",
        userId: "user-1",
        emailId: "email-1",
        domainId: "domain-1",
      }),
    ).resolves.toBeNull();
  });
});
