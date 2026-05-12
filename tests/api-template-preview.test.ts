import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockFindByIdForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/api-key-permissions", () => ({
  requireFullAccessApiKey: () => null,
}));

vi.mock("@opensend/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@opensend/core")>();
  return {
    ...actual,
    templateRepo: {
      ...actual.templateRepo,
      findByIdForUser: mockFindByIdForUser,
    },
  };
});

describe("GET /api/templates/:id/preview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({ dashboard: true });
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("renders React Email starters through the preview service with variable diagnostics", async () => {
    mockFindByIdForUser.mockResolvedValue({
      id: "tmpl-1",
      userId: "user-1",
      subject: null,
      html: "<p>legacy placeholder should not render</p>",
      text: null,
      variables: [
        {
          name: "productName",
          key: "productName",
          type: "string",
          required: false,
          fallbackValue: "Opensend",
        },
        {
          name: "actionUrl",
          key: "actionUrl",
          type: "string",
          required: true,
          fallbackValue: null,
        },
      ],
      document: {
        rendering: {
          kind: "react_email",
          templateKey: "onboarding-welcome",
        },
      },
    });

    const { GET } = await import("@/app/api/templates/[id]/preview/route");
    const response = await GET(
      new Request("http://localhost/api/templates/tmpl-1/preview") as never,
      { params: Promise.resolve({ id: "tmpl-1" }) },
    );

    expect(mockFindByIdForUser).toHaveBeenCalledWith("tmpl-1", "user-1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      object: "template_preview",
      id: "tmpl-1",
      rendering: {
        kind: "react_email",
        template_key: "onboarding-welcome",
      },
      subject: "Welcome to Opensend",
    });
    expect(body.html).toContain("Your email workspace is ready");
    expect(body.text).toContain("YOUR EMAIL WORKSPACE IS READY");
    expect(body.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "productName",
          source: "fallback",
          value: "Opensend",
        }),
        expect.objectContaining({
          key: "actionUrl",
          source: "preview_sample",
          sendRequired: true,
        }),
      ]),
    );
  });

  it("returns a validation error for unknown registry keys", async () => {
    mockFindByIdForUser.mockResolvedValue({
      id: "tmpl-1",
      userId: "user-1",
      subject: null,
      html: null,
      text: null,
      variables: [],
      document: {
        rendering: {
          kind: "react_email",
          templateKey: "tenant-provided-tsx-string",
        },
      },
    });

    const { GET } = await import("@/app/api/templates/[id]/preview/route");
    const response = await GET(
      new Request("http://localhost/api/templates/tmpl-1/preview") as never,
      { params: Promise.resolve({ id: "tmpl-1" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown React Email template key: tenant-provided-tsx-string",
    });
  });

  it("preserves the route not-found response when the preview service cannot find the template", async () => {
    mockFindByIdForUser.mockResolvedValue(undefined);

    const { GET } = await import("@/app/api/templates/[id]/preview/route");
    const response = await GET(
      new Request("http://localhost/api/templates/missing/preview") as never,
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(mockFindByIdForUser).toHaveBeenCalledWith("missing", "user-1");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Template not found",
    });
  });
});
