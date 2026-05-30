import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockDeleteDNSRecord = vi.hoisted(() => vi.fn());
const mockListDNSRecords = vi.hoisted(() => vi.fn());
const mockConfigureDNSRecords = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());
const mockDeleteDomainIdentity = vi.hoisted(() => vi.fn());
const mockGetDomainIdentity = vi.hoisted(() => vi.fn());
const mockCreateDomainIdentity = vi.hoisted(() => vi.fn());
const mockCheckDomainQuota = vi.hoisted(() => vi.fn());
const mockCreateDomainService = vi.hoisted(() => vi.fn());
const mockCreateDomainDetailService = vi.hoisted(() => vi.fn());
const mockCreateDomain = vi.hoisted(() => vi.fn());
const mockListDomains = vi.hoisted(() => vi.fn());
const mockGetDomainDetail = vi.hoisted(() => vi.fn());
const mockUpdateDomainDetail = vi.hoisted(() => vi.fn());
const mockDeleteDomainDetail = vi.hoisted(() => vi.fn());
const MockDomainDetailServiceError = vi.hoisted(
  () =>
    class DomainDetailServiceError extends Error {
      constructor(
        readonly code: string,
        message: string,
      ) {
        super(message);
        this.name = "DomainDetailServiceError";
      }
    },
);
const mockReconcileVerification = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
  query: {
    domains: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  authorizeDashboardOrApiKey: mockValidateApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/billing/quota", () => ({
  checkDomainQuota: mockCheckDomainQuota,
  quotaExceededResponse: () =>
    Response.json({ error: "Domain quota exceeded" }, { status: 402 }),
}));

vi.mock("@opensend/core", () => ({
  DomainDetailServiceError: MockDomainDetailServiceError,
  DMARC_RECORD_VALUE: "v=DMARC1; p=none;",
  buildDmarcRecordName: (domain: string) => `_dmarc.${domain}`,
  createDomainService: mockCreateDomainService,
  createDomainDetailService: mockCreateDomainDetailService,
  getEffectiveReturnPathLabel: (value: string | null | undefined) =>
    value?.trim() || "send",
}));

vi.mock("@/lib/cloudflare", () => ({
  configureDNSRecords: mockConfigureDNSRecords,
  deleteDNSRecord: mockDeleteDNSRecord,
  listDNSRecords: mockListDNSRecords,
}));

vi.mock("@/lib/events", () => ({
  queueEvent: mockQueueEvent,
}));

vi.mock("@/lib/ses", () => ({
  createDomainIdentity: mockCreateDomainIdentity,
  deleteDomainIdentity: mockDeleteDomainIdentity,
  getDomainIdentity: mockGetDomainIdentity,
}));

vi.mock("@/lib/domain-cache", () => ({
  getCachedDomainById: vi
    .fn()
    .mockImplementation(() => mockDb.query.domains.findFirst()),
  getCachedDomainIdentity: vi.fn(),
  invalidateDomainCaches: vi.fn().mockResolvedValue(undefined),
}));

const AUTH_RESULT = {
  apiKeyId: "key-uuid",
  permission: "full_access",
  domainId: null,
  userId: "user-1",
};

const VALID_DOMAIN_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(
  url: string,
  method: string,
  body?: Record<string, unknown>,
): Request {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: "Bearer os_test123",
      "Content-Type": "application/json",
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

describe("Domain API validation", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue(AUTH_RESULT);
    mockGetServerSession.mockReset();
    mockDeleteDNSRecord.mockReset();
    mockListDNSRecords.mockReset();
    mockConfigureDNSRecords.mockReset();
    mockQueueEvent.mockReset();
    mockDeleteDomainIdentity.mockReset();
    mockGetDomainIdentity.mockReset();
    mockCreateDomainIdentity.mockReset();
    mockReconcileVerification.mockReset();
    mockCheckDomainQuota.mockResolvedValue({
      ok: true,
      info: { limit: 10, used: 0 },
    });
    mockCreateDomainService.mockReset();
    mockCreateDomainDetailService.mockReset();
    mockCreateDomain.mockReset();
    mockListDomains.mockReset();
    mockCreateDomainService.mockImplementation(() => ({
      createDomain: mockCreateDomain,
      listDomains: mockListDomains,
      reconcileVerification: mockReconcileVerification,
    }));
    mockCreateDomainDetailService.mockImplementation(() => ({
      getDomainDetail: mockGetDomainDetail,
      updateDomainDetail: mockUpdateDomainDetail,
      deleteDomainDetail: mockDeleteDomainDetail,
    }));
    mockGetDomainDetail.mockReset();
    mockUpdateDomainDetail.mockReset();
    mockDeleteDomainDetail.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.delete.mockReset();
    mockDb.select.mockReset();
    mockDb.query.domains.findFirst.mockReset();
  });

  it("creates a domain and enqueues domain.created for the caller tenant", async () => {
    const createdAt = new Date("2026-05-06T00:00:00.000Z");
    mockCreateDomain.mockResolvedValueOnce({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [
        {
          type: "TXT",
          name: "_dmarc.example.com",
          value: "v=DMARC1; p=none;",
          status: "pending",
          ttl: "Auto",
        },
      ],
      customReturnPath: null,
      trackOpens: false,
      trackClicks: false,
      trackingSubdomain: null,
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      createdAt,
    });

    const { POST } = await import("@/app/api/domains/route");
    const req = makeRequest("http://localhost:3015/api/domains", "POST", {
      name: "Example.com",
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateDomain).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Example.com", userId: "user-1" }),
    );
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "domain.created",
      userId: "user-1",
      payload: expect.objectContaining({
        id: VALID_DOMAIN_ID,
        name: "example.com",
        status: "not_started",
        records: expect.any(Array),
        capabilities: expect.any(Array),
      }),
    });
  });

  it("wires domain creation through core without route-level SES provider imports", async () => {
    mockCreateDomain.mockResolvedValueOnce({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [],
      customReturnPath: null,
      trackOpens: false,
      trackClicks: false,
      trackingSubdomain: null,
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      createdAt: new Date("2026-05-06T00:00:00.000Z"),
    });

    const { POST } = await import("@/app/api/domains/route");
    const res = await POST(
      makeRequest("http://localhost:3015/api/domains", "POST", {
        name: "example.com",
      }),
    );

    expect(res.status).toBe(201);
    expect(mockCreateDomainService).toHaveBeenCalledWith({
      invalidateDomainCaches: expect.any(Function),
    });
    expect(mockCreateDomainService).not.toHaveBeenCalledWith(
      expect.objectContaining({
        createDomainIdentity: expect.any(Function),
      }),
    );
  });

  it("creates a domain from an authenticated dashboard session", async () => {
    const createdAt = new Date("2026-05-06T00:00:00.000Z");
    mockValidateApiKey.mockResolvedValueOnce({ dashboard: true });
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "dashboard-user-1" },
    });
    mockCreateDomain.mockResolvedValueOnce({
      id: VALID_DOMAIN_ID,
      name: "dashboard.example.com",
      status: "not_started",
      region: "us-east-1",
      records: [],
      customReturnPath: null,
      trackOpens: false,
      trackClicks: false,
      trackingSubdomain: null,
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      createdAt,
    });

    const { POST } = await import("@/app/api/domains/route");
    const res = await POST(
      new Request("http://localhost:3015/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Dashboard.Example.com" }),
      }),
    );

    expect(res.status).toBe(201);
    expect(mockCreateDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Dashboard.Example.com",
        userId: "dashboard-user-1",
      }),
    );
    expect(mockQueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "domain.created",
        userId: "dashboard-user-1",
      }),
    );
  });

  it("gets a domain detail through the service adapter with the public response shape", async () => {
    const createdAt = new Date("2026-05-06T00:00:00.000Z");
    mockGetDomainDetail.mockResolvedValueOnce({
      object: "domain",
      id: VALID_DOMAIN_ID,
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [],
      custom_return_path: null,
      return_path: "send",
      open_tracking: false,
      click_tracking: true,
      tracking_subdomain: "track.example.com",
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      created_at: createdAt,
    });

    const { GET } = await import("@/app/api/domains/[id]/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
      "GET",
    );

    const res = await GET(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetDomainDetail).toHaveBeenCalledWith({
      id: VALID_DOMAIN_ID,
      userId: "user-1",
    });
    expect(json).toEqual({
      object: "domain",
      id: VALID_DOMAIN_ID,
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [],
      custom_return_path: null,
      return_path: "send",
      open_tracking: false,
      click_tracking: true,
      tracking_subdomain: "track.example.com",
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      created_at: "2026-05-06T00:00:00.000Z",
    });
  });

  it("updates a domain and enqueues domain.updated for the caller tenant", async () => {
    mockUpdateDomainDetail.mockResolvedValueOnce({
      response: { object: "domain", id: VALID_DOMAIN_ID },
      changedFields: ["open_tracking"],
      eventPayload: {
        id: VALID_DOMAIN_ID,
        changed_fields: ["open_tracking"],
        domain: {
          id: VALID_DOMAIN_ID,
          name: "example.com",
          status: "not_started",
          region: "us-east-1",
          records: [],
          capabilities: [{ name: "sending", enabled: true }],
          created_at: "2026-05-06T00:00:00.000Z",
        },
      },
    });

    const { PATCH } = await import("@/app/api/domains/[id]/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
      "PATCH",
      { open_tracking: true },
    );

    const res = await PATCH(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "domain",
      id: VALID_DOMAIN_ID,
    });
    expect(mockUpdateDomainDetail).toHaveBeenCalledWith({
      id: VALID_DOMAIN_ID,
      userId: "user-1",
      updates: { open_tracking: true },
    });
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "domain.updated",
      userId: "user-1",
      payload: expect.objectContaining({
        id: VALID_DOMAIN_ID,
        changed_fields: ["open_tracking"],
        domain: expect.objectContaining({
          id: VALID_DOMAIN_ID,
          name: "example.com",
        }),
      }),
    });
  });

  it("wires domain detail mutations through core without route-level SES or Cloudflare providers", async () => {
    mockDeleteDomainDetail.mockResolvedValueOnce({
      response: { object: "domain", id: VALID_DOMAIN_ID, deleted: true },
      eventPayload: { id: VALID_DOMAIN_ID, name: "example.com" },
    });

    const { DELETE } = await import("@/app/api/domains/[id]/route");
    const res = await DELETE(
      makeRequest(
        `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
        "DELETE",
      ),
      { params: Promise.resolve({ id: VALID_DOMAIN_ID }) },
    );

    expect(res.status).toBe(200);
    expect(mockCreateDomainDetailService).toHaveBeenCalledWith({
      getDomainById: expect.any(Function),
      invalidateDomainCaches: expect.any(Function),
    });
    expect(mockCreateDomainDetailService).not.toHaveBeenCalledWith(
      expect.objectContaining({
        deleteDomainIdentity: expect.any(Function),
      }),
    );
    expect(mockCreateDomainDetailService).not.toHaveBeenCalledWith(
      expect.objectContaining({
        listDNSRecords: expect.any(Function),
      }),
    );
    expect(mockCreateDomainDetailService).not.toHaveBeenCalledWith(
      expect.objectContaining({
        deleteDNSRecord: expect.any(Function),
      }),
    );
  });

  it("deletes a domain and enqueues domain.deleted for the caller tenant", async () => {
    mockDeleteDomainDetail.mockResolvedValueOnce({
      response: { object: "domain", id: VALID_DOMAIN_ID, deleted: true },
      eventPayload: { id: VALID_DOMAIN_ID, name: "example.com" },
    });

    const { DELETE } = await import("@/app/api/domains/[id]/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
      "DELETE",
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      object: "domain",
      id: VALID_DOMAIN_ID,
      deleted: true,
    });
    expect(mockDeleteDomainDetail).toHaveBeenCalledWith({
      id: VALID_DOMAIN_ID,
      userId: "user-1",
    });
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "domain.deleted",
      userId: "user-1",
      payload: { id: VALID_DOMAIN_ID, name: "example.com" },
    });
  });

  it("returns 422 for invalid domain create payload", async () => {
    const { POST } = await import("@/app/api/domains/route");
    const req = makeRequest("http://localhost:3015/api/domains", "POST", {
      name: "",
      region: "moon-1",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Validation failed");
    expect(json.details.fieldErrors.name).toBeDefined();
    expect(json.details.fieldErrors.region).toBeDefined();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns 422 for invalid custom return path labels", async () => {
    const { POST } = await import("@/app/api/domains/route");
    const req = makeRequest("http://localhost:3015/api/domains", "POST", {
      name: "example.com",
      custom_return_path: "outbound.example",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Validation failed");
    expect(json.details.fieldErrors.custom_return_path).toBeDefined();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("forwards a validated tracking subdomain label during create", async () => {
    mockCreateDomain.mockResolvedValueOnce({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [
        {
          type: "CNAME",
          name: "links.example.com",
          value: "track.opensend.example",
          status: "pending",
          ttl: "Auto",
        },
      ],
      customReturnPath: null,
      trackOpens: false,
      trackClicks: false,
      trackingSubdomain: "links",
      tls: "opportunistic",
      capabilities: [{ name: "sending", enabled: true }],
      createdAt: new Date("2026-05-06T00:00:00.000Z"),
    });

    const { POST } = await import("@/app/api/domains/route");
    const res = await POST(
      makeRequest("http://localhost:3015/api/domains", "POST", {
        name: "example.com",
        tracking_subdomain: "links",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(mockCreateDomain).toHaveBeenCalledWith(
      expect.objectContaining({ trackingSubdomain: "links" }),
    );
    expect(json.tracking_subdomain).toBe("links");
    expect(json.records).toContainEqual({
      type: "CNAME",
      name: "links.example.com",
      value: "track.opensend.example",
      status: "pending",
      ttl: "Auto",
    });
  });

  it("returns 422 for invalid tracking subdomain labels", async () => {
    const { POST } = await import("@/app/api/domains/route");
    const req = makeRequest("http://localhost:3015/api/domains", "POST", {
      name: "example.com",
      tracking_subdomain: "links.example.com",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Validation failed");
    expect(json.details.fieldErrors.tracking_subdomain).toBeDefined();
    expect(mockCreateDomain).not.toHaveBeenCalled();
  });

  it("returns 422 for invalid domain update payload", async () => {
    const { PATCH } = await import("@/app/api/domains/[id]/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
      "PATCH",
      {
        click_tracking: "yes" as unknown as boolean,
        tls: "strict",
      },
    );

    const res = await PATCH(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Validation failed");
    expect(json.details.fieldErrors.click_tracking).toBeDefined();
    expect(json.details.fieldErrors.tls).toBeDefined();
    expect(mockUpdateDomainDetail).not.toHaveBeenCalled();
  });

  it("accepts a tracking subdomain label during update", async () => {
    mockUpdateDomainDetail.mockResolvedValueOnce({
      response: { object: "domain", id: VALID_DOMAIN_ID },
      changedFields: ["tracking_subdomain"],
      eventPayload: {
        id: VALID_DOMAIN_ID,
        changed_fields: ["tracking_subdomain"],
        domain: {
          id: VALID_DOMAIN_ID,
          name: "example.com",
          status: "not_started",
          region: "us-east-1",
          records: [
            {
              type: "CNAME",
              name: "links.example.com",
              value: "track.opensend.example",
              status: "pending",
              ttl: "Auto",
            },
          ],
          capabilities: [{ name: "sending", enabled: true }],
          created_at: "2026-05-06T00:00:00.000Z",
        },
      },
    });

    const { PATCH } = await import("@/app/api/domains/[id]/route");
    const res = await PATCH(
      makeRequest(
        `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
        "PATCH",
        { tracking_subdomain: "links" },
      ),
      { params: Promise.resolve({ id: VALID_DOMAIN_ID }) },
    );

    expect(res.status).toBe(200);
    expect(mockUpdateDomainDetail).toHaveBeenCalledWith({
      id: VALID_DOMAIN_ID,
      userId: "user-1",
      updates: { tracking_subdomain: "links" },
    });
  });

  it("returns 422 for invalid domain detail params before calling the service", async () => {
    const { GET } = await import("@/app/api/domains/[id]/route");
    const req = makeRequest(
      "http://localhost:3015/api/domains/not-a-uuid",
      "GET",
    );

    const res = await GET(req, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Validation failed");
    expect(json.details.fieldErrors.id).toBeDefined();
    expect(mockGetDomainDetail).not.toHaveBeenCalled();
  });

  it("maps domain detail service not-found errors to the legacy 404 body", async () => {
    mockUpdateDomainDetail.mockRejectedValueOnce(
      new MockDomainDetailServiceError("not_found", "Not found"),
    );

    const { PATCH } = await import("@/app/api/domains/[id]/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}`,
      "PATCH",
      { open_tracking: true },
    );

    const res = await PATCH(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not found" });
  });

  it("returns 422 for invalid domain verify params", async () => {
    const { POST } = await import("@/app/api/domains/[id]/verify/route");
    const req = makeRequest(
      "http://localhost:3015/api/domains/not-a-uuid/verify",
      "POST",
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Validation failed");
    expect(json.details.fieldErrors.id).toBeDefined();
    expect(mockDb.query.domains.findFirst).not.toHaveBeenCalled();
  });

  it("verifies domain when params are valid", async () => {
    const domain = {
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "user-1",
      status: "pending",
      records: [
        {
          type: "TXT",
          name: "_dmarc.example.com",
          value: "v=DMARC1; p=none;",
          status: "pending",
          ttl: "Auto",
        },
      ],
    };
    const updated = {
      ...domain,
      status: "verified",
      records: [
        {
          type: "TXT",
          name: "_dmarc.example.com",
          value: "v=DMARC1; p=none;",
          status: "verified",
          ttl: "Auto",
        },
      ],
      capabilities: [],
      customReturnPath: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    mockDb.query.domains.findFirst.mockResolvedValue(domain);
    mockReconcileVerification.mockResolvedValue({
      status: "updated",
      domain: updated,
      previousStatus: "pending",
    });

    const { POST } = await import("@/app/api/domains/[id]/verify/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}/verify`,
      "POST",
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("verified");
    expect(json.records).toContainEqual({
      type: "TXT",
      name: "_dmarc.example.com",
      value: "v=DMARC1; p=none;",
      status: "verified",
      ttl: "Auto",
    });
    expect(mockReconcileVerification).toHaveBeenCalledWith(VALID_DOMAIN_ID);
    expect(mockQueueEvent).toHaveBeenCalledWith({
      type: "domain.updated",
      userId: "user-1",
      payload: expect.objectContaining({
        id: VALID_DOMAIN_ID,
        name: "example.com",
        status: "verified",
        previous_status: "pending",
      }),
    });
  });

  it("returns 404 when verifying a domain owned by another tenant", async () => {
    mockDb.query.domains.findFirst.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "other-user",
      status: "pending",
      records: [],
    });

    const { POST } = await import("@/app/api/domains/[id]/verify/route");
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}/verify`,
      "POST",
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });

    expect(res.status).toBe(404);
    expect(mockReconcileVerification).not.toHaveBeenCalled();
  });

  it("auto-configures persisted DNS records through Cloudflare for the caller tenant", async () => {
    const records = [
      {
        type: "CNAME",
        name: "links.example.com",
        value: "track.opensend.example",
        status: "pending",
        ttl: "Auto",
      },
    ];
    mockDb.query.domains.findFirst.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      userId: "user-1",
      status: "pending",
      records,
    });
    mockConfigureDNSRecords.mockResolvedValueOnce([
      {
        action: "created",
        name: "links.example.com",
        type: "CNAME",
        record: {
          id: "dns-track",
          type: "CNAME",
          name: "links.example.com",
          content: "track.opensend.example",
          ttl: 1,
        },
      },
    ]);

    const { POST } = await import(
      "@/app/api/domains/[id]/auto-configure/route"
    );
    const res = await POST(
      makeRequest(
        `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}/auto-configure`,
        "POST",
      ),
      { params: Promise.resolve({ id: VALID_DOMAIN_ID }) },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockConfigureDNSRecords).toHaveBeenCalledWith(records);
    expect(json.dns_records).toEqual([
      expect.objectContaining({
        action: "created",
        name: "links.example.com",
        type: "CNAME",
      }),
    ]);
  });
});

describe("Domain API key permission enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "sending-key",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });
  });

  it("rejects sending-access keys from managing domains", async () => {
    const { POST } = await import("@/app/api/domains/route");
    const res = await POST(
      makeRequest("http://localhost:3015/api/domains", "POST", {
        name: "blocked.example.com",
      }),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "insufficient_api_key_permission",
      statusCode: 403,
    });
    expect(mockCreateDomain).not.toHaveBeenCalled();
  });
});
