import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockRequireFullAccessApiKey = vi.hoisted(() => vi.fn());
const mockTemplateService = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  getTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  publishTemplate: vi.fn(),
  duplicateTemplate: vi.fn(),
}));

class TestTemplateServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TemplateServiceError";
  }
}

function makeRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request;
}

const createdAt = new Date("2026-05-13T00:00:00.000Z");

const listTemplate = {
  id: "tmpl-1",
  name: "Receipt",
  alias: "receipt",
  status: "draft",
  currentVersionId: null,
  publishedAt: null,
  hasUnpublishedVersions: true,
  createdAt,
};

const detailTemplate = {
  ...listTemplate,
  subject: "Receipt for {{name}}",
  from: "Acme <billing@example.com>",
  replyTo: "reply@example.com",
  previewText: "Receipt preview",
  html: "<p>Hello</p>",
  text: "Hello",
  variables: [],
  updatedAt: createdAt,
};

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessApiKey: mockRequireFullAccessApiKey,
}));

vi.mock("@opensend/core", () => ({
  TemplateServiceError: TestTemplateServiceError,
  createTemplateService: () => mockTemplateService,
}));

describe("Resend-compatible root templates API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: null,
      userId: "user-1",
    });
    mockRequireFullAccessApiKey.mockReturnValue(null);
  });

  it("lists and creates templates with root compatibility envelopes", async () => {
    mockTemplateService.listTemplates.mockResolvedValueOnce({
      data: [listTemplate],
      total: 1,
      hasMore: false,
    });
    mockTemplateService.createTemplate.mockResolvedValueOnce({
      id: "tmpl-created",
      name: "Welcome",
      alias: "welcome",
    });

    const route = await import("@/app/api/public/templates/route");

    const listResponse = await route.GET(
      makeRequest(
        "http://localhost/templates?limit=10&after=tmpl-0&search=rec&status=draft",
        {
          headers: { authorization: "Bearer os_test" },
        },
      ) as never,
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      object: "list",
      data: [
        {
          object: "template",
          id: "tmpl-1",
          name: "Receipt",
          alias: "receipt",
          status: "draft",
          current_version_id: null,
          published_at: null,
          has_unpublished_versions: true,
          created_at: createdAt.toISOString(),
        },
      ],
      has_more: false,
    });
    expect(mockTemplateService.listTemplates).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 10,
      after: "tmpl-0",
      search: "rec",
      status: "draft",
    });

    const createResponse = await route.POST(
      makeRequest("http://localhost/templates", {
        method: "POST",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Welcome",
          alias: "welcome",
          html: "<p>Hi</p>",
          reply_to: "reply@example.com",
        }),
      }) as never,
    );
    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      object: "template",
      id: "tmpl-created",
    });
    expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
      {
        name: "Welcome",
        alias: "welcome",
        html: "<p>Hi</p>",
        reply_to: "reply@example.com",
      },
      { userId: "user-1" },
    );
  });

  it("retrieves, updates, deletes, publishes, and duplicates by ID or alias within the API-key tenant", async () => {
    mockTemplateService.getTemplate
      .mockResolvedValueOnce(detailTemplate)
      .mockResolvedValueOnce(detailTemplate);
    mockTemplateService.updateTemplate.mockResolvedValueOnce({
      ...detailTemplate,
      id: "tmpl-1",
    });
    mockTemplateService.deleteTemplate.mockResolvedValueOnce(undefined);
    mockTemplateService.publishTemplate.mockResolvedValueOnce({ id: "tmpl-1" });
    mockTemplateService.duplicateTemplate.mockResolvedValueOnce({
      id: "tmpl-2",
    });

    const detailRoute = await import("@/app/api/public/templates/[id]/route");
    const publishRoute = await import(
      "@/app/api/public/templates/[id]/publish/route"
    );
    const duplicateRoute = await import(
      "@/app/api/public/templates/[id]/duplicate/route"
    );

    const getResponse = await detailRoute.GET(
      makeRequest("http://localhost/templates/receipt", {
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "receipt" }) },
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      object: "template",
      id: "tmpl-1",
      alias: "receipt",
      reply_to: "reply@example.com",
      preview_text: "Receipt preview",
    });

    const updateResponse = await detailRoute.PATCH(
      makeRequest("http://localhost/templates/receipt", {
        method: "PATCH",
        headers: {
          authorization: "Bearer os_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ reply_to: "new@example.com" }),
      }) as never,
      { params: Promise.resolve({ id: "receipt" }) },
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toEqual({
      object: "template",
      id: "tmpl-1",
    });

    const deleteResponse = await detailRoute.DELETE(
      makeRequest("http://localhost/templates/receipt", {
        method: "DELETE",
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "receipt" }) },
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      object: "template",
      id: "tmpl-1",
      deleted: true,
    });

    const publishResponse = await publishRoute.POST(
      makeRequest("http://localhost/templates/receipt/publish", {
        method: "POST",
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "receipt" }) },
    );
    expect(publishResponse.status).toBe(200);
    await expect(publishResponse.json()).resolves.toEqual({
      object: "template",
      id: "tmpl-1",
    });

    const duplicateResponse = await duplicateRoute.POST(
      makeRequest("http://localhost/templates/receipt/duplicate", {
        method: "POST",
        headers: { authorization: "Bearer os_test" },
      }) as never,
      { params: Promise.resolve({ id: "receipt" }) },
    );
    expect(duplicateResponse.status).toBe(200);
    await expect(duplicateResponse.json()).resolves.toEqual({
      object: "template",
      id: "tmpl-2",
    });

    expect(mockTemplateService.getTemplate).toHaveBeenNthCalledWith(
      1,
      "receipt",
      {
        userId: "user-1",
      },
    );
    expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith(
      "receipt",
      { reply_to: "new@example.com" },
      { userId: "user-1" },
    );
    expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith("receipt", {
      userId: "user-1",
    });
    expect(mockTemplateService.publishTemplate).toHaveBeenCalledWith(
      "receipt",
      {
        userId: "user-1",
      },
    );
    expect(mockTemplateService.duplicateTemplate).toHaveBeenCalledWith(
      "receipt",
      {
        userId: "user-1",
      },
    );
  });

  it("keeps root templates API-key-only and requires full-access keys", async () => {
    const route = await import("@/app/api/public/templates/route");

    mockValidateApiKey.mockResolvedValueOnce(null);
    const unauthenticated = await route.GET(
      makeRequest("http://localhost/templates", {
        headers: { accept: "application/json" },
      }) as never,
    );
    expect(unauthenticated.status).toBe(401);
    expect(mockTemplateService.listTemplates).not.toHaveBeenCalled();

    mockValidateApiKey.mockResolvedValueOnce({
      apiKeyId: "key-2",
      permission: "sending_access",
      domain: null,
      userId: "user-1",
    });
    mockRequireFullAccessApiKey.mockReturnValueOnce(
      Response.json({ error: "forbidden" }, { status: 403 }),
    );
    const forbidden = await route.POST(
      makeRequest("http://localhost/templates", {
        method: "POST",
        headers: {
          authorization: "Bearer os_send",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Nope", html: "<p>Nope</p>" }),
      }) as never,
    );
    expect(forbidden.status).toBe(403);
    expect(mockTemplateService.createTemplate).not.toHaveBeenCalled();
  });
});
