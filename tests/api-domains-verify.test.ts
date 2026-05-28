/**
 * Integration test for POST /api/domains/[id]/verify
 *
 * Uses the REAL createDomainService factory — @opensend/core is NOT mocked
 * for the factory function. Instead we:
 *   - Mock @/lib/domain-cache to provide a spy for invalidateDomainCaches
 *     (the spy is injected into the factory at module scope in the route)
 *   - Stub the repository and getDomainIdentity via @opensend/core's provider
 *   - Assert the spy is called exactly once for every result branch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockGetCachedDomainById = vi.hoisted(() => vi.fn());
const mockInvalidateDomainCaches = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
const mockQueueEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockRecordAuditEvent = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

// ── Infrastructure mocks ──────────────────────────────────────────────────────

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockValidateApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessForApiKeyCaller: () => null,
}));

vi.mock("@/lib/audit-events", () => ({
  auditContextForApiKey: (input: { userId: string; apiKeyId: string }) => ({
    userId: input.userId,
    apiKeyId: input.apiKeyId,
  }),
  auditContextForDashboardSession: () => null,
  recordAuditEvent: mockRecordAuditEvent,
}));

vi.mock("@/lib/domain-cache", () => ({
  getCachedDomainById: mockGetCachedDomainById,
  invalidateDomainCaches: mockInvalidateDomainCaches,
}));

vi.mock("@/lib/events", () => ({
  queueEvent: mockQueueEvent,
}));

// ── Suppress repository + SES calls from the real factory ────────────────────
// We mock the domainRepo and domainIdentityProvider used by the real factory
// so tests don't hit the database or AWS.

const mockFindById = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockGetDomainIdentity = vi.hoisted(() => vi.fn());

vi.mock("../packages/core/src/db/repositories/domainRepo", () => ({
  domainRepo: {
    list: vi.fn().mockResolvedValue({ data: [], hasMore: false }),
    listPendingVerification: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    findById: mockFindById,
    update: mockUpdate,
    delete: vi.fn(),
  },
}));

vi.mock("../packages/core/src/services/domain-providers", () => ({
  domainIdentityProvider: {
    createDomainIdentity: vi.fn(),
    getDomainIdentity: mockGetDomainIdentity,
    deleteDomainIdentity: vi.fn(),
  },
}));

vi.mock("../packages/core/src/services/configurationSet", () => ({
  configurationSetService: {
    syncDomainConfigurationSet: vi.fn().mockResolvedValue("cfg-set-1"),
  },
}));

// ── Test data helpers ─────────────────────────────────────────────────────────

const VALID_DOMAIN_ID = "11111111-1111-4111-8111-111111111111";

function makeDomainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_DOMAIN_ID,
    name: "example.com",
    status: "pending",
    region: "us-east-1",
    dkimTokens: [],
    records: [
      {
        type: "TXT",
        name: "_dmarc.example.com",
        value: "v=DMARC1; p=none;",
        status: "pending",
        ttl: "Auto",
      },
    ],
    trackClicks: false,
    trackOpens: false,
    tls: "opportunistic",
    createdAt: new Date("2026-05-28T00:00:00.000Z"),
    document: null,
    userId: "user-1",
    customReturnPath: null,
    trackingSubdomain: null,
    capabilities: [{ name: "sending", enabled: true }],
    dkimOrigin: "AWS_SES",
    dkimSelector: null,
    dkimPublicKey: null,
    dkimPrivateKeyCt: null,
    dkimPrivateKeyIv: null,
    dedicatedIpPoolId: null,
    sesConfigurationSetName: null,
    ...overrides,
  };
}

function buildRequest(id = VALID_DOMAIN_ID) {
  return new Request(`http://localhost/api/domains/${id}/verify`, {
    method: "POST",
    headers: { authorization: "Bearer test-key" },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/domains/[id]/verify", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });

    // Default: getCachedDomainById returns a matching domain
    mockGetCachedDomainById.mockResolvedValue(makeDomainRow());
    // Default: repository findById returns the same domain
    mockFindById.mockResolvedValue(makeDomainRow());
    // Default: update returns the updated domain
    mockUpdate.mockResolvedValue([makeDomainRow({ status: "verified" })]);
    // Default: getDomainIdentity says verified
    mockGetDomainIdentity.mockResolvedValue({ verified: true });
    // Reset the spy counter
    mockInvalidateDomainCaches.mockClear();
  });

  it("calls invalidateDomainCaches exactly once on the updated branch", async () => {
    mockGetDomainIdentity.mockResolvedValue({ verified: true });
    mockUpdate.mockResolvedValue([makeDomainRow({ status: "verified" })]);

    const route = await import("@/app/api/domains/[id]/verify/route");
    const response = await route.POST(buildRequest(), {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("verified");

    // invalidateDomainCaches should be called exactly once (by the service)
    expect(mockInvalidateDomainCaches).toHaveBeenCalledOnce();
    expect(mockInvalidateDomainCaches).toHaveBeenCalledWith(
      expect.objectContaining({ id: VALID_DOMAIN_ID }),
    );
  });

  it("calls invalidateDomainCaches exactly once on the unchanged branch", async () => {
    // Status is already pending and SES still says not-verified
    mockGetDomainIdentity.mockResolvedValue({ verified: false });
    // Domain is already pending — records stay pending — no status change
    mockFindById.mockResolvedValue(makeDomainRow({ status: "pending" }));

    const route = await import("@/app/api/domains/[id]/verify/route");
    const response = await route.POST(buildRequest(), {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(response.status).toBe(200);
    // On unchanged, the service still calls invalidateDomainCaches once (repair)
    expect(mockInvalidateDomainCaches).toHaveBeenCalledOnce();
  });

  it("returns 404 on the not_found branch (DB row missing after cache hit) and does NOT call invalidateDomainCaches", async () => {
    // Cache returns a domain but the DB row is gone (concurrent delete).
    // The service exits immediately with { status: "not_found" } — no caches
    // to invalidate at this point (the row never existed in Redis if it was
    // just deleted). The route itself no longer calls invalidateDomainCaches.
    mockFindById.mockResolvedValue(undefined);

    const route = await import("@/app/api/domains/[id]/verify/route");
    const response = await route.POST(buildRequest(), {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(response.status).toBe(404);
    // No cache invalidation on the not_found fast-exit path
    expect(mockInvalidateDomainCaches).not.toHaveBeenCalled();
  });
});
