import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockDeleteDNSRecord = vi.hoisted(() => vi.fn());
const mockListDNSRecords = vi.hoisted(() => vi.fn());
const mockAutoConfigureDomain = vi.hoisted(() => vi.fn());
const mockQueueEvent = vi.hoisted(() => vi.fn());
const mockDeleteDomainIdentity = vi.hoisted(() => vi.fn());
const mockGetDomainIdentity = vi.hoisted(() => vi.fn());
const mockCreateDomainIdentity = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
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
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/cloudflare", () => ({
  autoConfigureDomain: mockAutoConfigureDomain,
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

const AUTH_RESULT = {
  apiKeyId: "key-uuid",
  permission: "full_access",
  domainId: null,
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
      Authorization: "Bearer re_test123",
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
    mockDeleteDNSRecord.mockReset();
    mockListDNSRecords.mockReset();
    mockAutoConfigureDomain.mockReset();
    mockQueueEvent.mockReset();
    mockDeleteDomainIdentity.mockReset();
    mockGetDomainIdentity.mockReset();
    mockCreateDomainIdentity.mockReset();
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockDb.select.mockReset();
    mockDb.query.domains.findFirst.mockReset();
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
    expect(mockDb.update).not.toHaveBeenCalled();
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
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    mockDb.query.domains.findFirst.mockResolvedValue(domain);
    mockGetDomainIdentity.mockResolvedValue({ verified: true });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
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
      status: "pending",
      ttl: "Auto",
    });
    expect(mockDb.query.domains.findFirst).toHaveBeenCalledTimes(1);
    expect(mockQueueEvent).toHaveBeenCalledTimes(1);
  });

  it("returns 422 for invalid auto-configure params", async () => {
    const { POST } = await import(
      "@/app/api/domains/[id]/auto-configure/route"
    );
    const req = makeRequest(
      "http://localhost:3015/api/domains/not-a-uuid/auto-configure",
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

  it("auto-configures domain when params are valid", async () => {
    mockDb.query.domains.findFirst.mockResolvedValue({
      id: VALID_DOMAIN_ID,
      name: "example.com",
      customReturnPath: "outbound",
      records: [
        {
          type: "TXT",
          name: "_dmarc.example.com",
          value: "v=DMARC1; p=none;",
          status: "pending",
          ttl: "Auto",
        },
      ],
    });
    mockCreateDomainIdentity.mockResolvedValue({
      dkimTokens: ["dkim-1", "dkim-2", "dkim-3"],
    });
    mockAutoConfigureDomain.mockResolvedValue({
      records: [
        {
          type: "TXT",
          name: "outbound.example.com",
          content: "v=spf1 include:amazonses.com ~all",
        },
        {
          type: "TXT",
          name: "_dmarc.example.com",
          content: "v=DMARC1; p=none;",
        },
      ],
      warnings: [],
    });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { POST } = await import(
      "@/app/api/domains/[id]/auto-configure/route"
    );
    const req = makeRequest(
      `http://localhost:3015/api/domains/${VALID_DOMAIN_ID}/auto-configure`,
      "POST",
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: VALID_DOMAIN_ID }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.cloudflare_records).toBe(2);
    expect(json.records).toContainEqual({
      type: "TXT",
      name: "_dmarc.example.com",
      value: "v=DMARC1; p=none;",
      status: "pending",
      ttl: "Auto",
    });
    expect(mockAutoConfigureDomain).toHaveBeenCalledWith(
      "example.com",
      ["dkim-1", "dkim-2", "dkim-3"],
      "outbound",
    );
  });
});
