import { describe, expect, it, vi } from "vitest";
import {
  type TemplateRepository,
  type TemplateServiceError,
  createTemplateService,
} from "../packages/core/src/services/template";

type TemplateRow = NonNullable<
  Awaited<ReturnType<TemplateRepository["findById"]>>
>;
type TemplateInsert = Parameters<TemplateRepository["create"]>[0];

const CREATED_AT = new Date("2026-05-09T00:00:00.000Z");

function templateRow(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: "tmpl-1",
    name: "Receipt",
    alias: "receipt",
    status: "draft",
    subject: "Order {{{PRODUCT}}}",
    from: null,
    replyTo: null,
    previewText: null,
    html: "<p>{{{PRODUCT}}}</p>",
    text: "Product: {{{PRODUCT}}}",
    variables: [],
    currentVersionId: null,
    publishedAt: null,
    hasUnpublishedVersions: true,
    createdAt: CREATED_AT,
    document: null,
    userId: null,
    ...overrides,
  };
}

function createRepository(
  overrides: Partial<TemplateRepository> = {},
): TemplateRepository {
  return {
    async findById() {
      return templateRow();
    },
    async findByIdOrAlias() {
      return templateRow();
    },
    async create(data) {
      return [templateRow({ ...data, id: "tmpl-1" })];
    },
    async update(id, data) {
      return [templateRow({ id, ...data })];
    },
    async delete(id) {
      return [templateRow({ id })];
    },
    async listForApi() {
      return { data: [], total: 0, hasMore: false };
    },
    ...overrides,
  };
}

describe("template variable metadata service", () => {
  it("accepts Resend-style variables on create and stores type/fallback metadata", async () => {
    const inserted: TemplateInsert[] = [];
    const repository = createRepository({
      async create(data) {
        inserted.push(data);
        return [templateRow({ ...data })];
      },
    });

    const service = createTemplateService({ repository });
    const created = await service.createTemplate({
      name: "Receipt",
      subject: "Order {{{PRODUCT}}}",
      html: "<p>{{{PRODUCT}}} costs {{{PRICE}}}</p>",
      variables: [
        { key: "PRODUCT", type: "string", fallbackValue: "item" },
        { key: "PRICE", type: "number", fallback_value: 25 },
        { name: "legacy_name", required: true },
      ],
    });

    expect(created).toMatchObject({ id: "tmpl-1", name: "Receipt" });
    expect(inserted[0]).toMatchObject({
      variables: [
        {
          name: "PRODUCT",
          key: "PRODUCT",
          type: "string",
          required: false,
          fallbackValue: "item",
        },
        {
          name: "PRICE",
          key: "PRICE",
          type: "number",
          required: false,
          fallbackValue: 25,
        },
        {
          name: "legacy_name",
          key: "legacy_name",
          type: "string",
          required: true,
          fallbackValue: null,
        },
      ],
    });
  });

  it("stores the authenticated dashboard user on created templates", async () => {
    const inserted: TemplateInsert[] = [];
    const repository = createRepository({
      async create(data) {
        inserted.push(data);
        return [templateRow({ ...data })];
      },
    });

    await createTemplateService({ repository }).createTemplate(
      {
        name: "Dashboard draft",
        html: "<p>Hello</p>",
      },
      { userId: "user-123" },
    );

    expect(inserted[0]?.userId).toBe("user-123");
  });

  it("creates React Email starter templates from registry metadata only", async () => {
    const inserted: TemplateInsert[] = [];
    const repository = createRepository({
      async create(data) {
        inserted.push(data);
        return [templateRow({ ...data })];
      },
    });

    await createTemplateService({ repository }).createTemplate({
      name: "Onboarding welcome",
      react_email_template_key: "onboarding-welcome",
    });

    expect(inserted[0]).toMatchObject({
      name: "Onboarding welcome",
      html: "<!-- React Email registry template: onboarding-welcome -->",
      document: {
        rendering: {
          kind: "react_email",
          templateKey: "onboarding-welcome",
        },
        starter: {
          key: "onboarding-welcome",
          source: "opensend-registry",
        },
      },
      variables: expect.arrayContaining([
        expect.objectContaining({
          key: "actionUrl",
          required: true,
          fallbackValue: null,
        }),
        expect.objectContaining({
          key: "productName",
          required: true,
          fallbackValue: null,
        }),
        expect.objectContaining({
          key: "supportEmail",
          required: true,
          fallbackValue: null,
        }),
      ]),
    });
  });

  it("rejects unknown React Email starter keys instead of accepting tenant code", async () => {
    const create = vi.fn(async () => [templateRow()]);
    const service = createTemplateService({
      repository: createRepository({ create }),
    });

    await expect(
      service.createTemplate({
        name: "Tenant TSX",
        react_email_template_key: "tenant-provided-tsx-string",
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Unknown React Email template key: tenant-provided-tsx-string",
    } satisfies Partial<TemplateServiceError>);
    expect(create).not.toHaveBeenCalled();
  });

  it("preserves reserved-name and 50-variable validation on create", async () => {
    const create = vi.fn(async () => [templateRow()]);
    const service = createTemplateService({
      repository: createRepository({ create }),
    });

    await expect(
      service.createTemplate({
        name: "Bad",
        html: "<p>Bad</p>",
        variables: [{ key: "EMAIL", type: "string" }],
      }),
    ).rejects.toMatchObject({
      code: "invalid_variables",
      message: "Variable name EMAIL is reserved.",
    } satisfies Partial<TemplateServiceError>);

    await expect(
      service.createTemplate({
        name: "Too many",
        html: "<p>Bad</p>",
        variables: Array.from({ length: 51 }, (_, index) => ({
          key: `VAR_${index}`,
          type: "string",
        })),
      }),
    ).rejects.toMatchObject({
      code: "invalid_variables",
      message: "Too many variables. Max allowed is 50.",
    } satisfies Partial<TemplateServiceError>);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns configured fallback_value and legacy variable metadata on detail", async () => {
    const service = createTemplateService({
      repository: createRepository({
        async findByIdOrAlias(idOrAlias, userId) {
          expect(idOrAlias).toBe("receipt");
          expect(userId).toBe("user-1");
          return templateRow({
            variables: [
              {
                name: "PRODUCT",
                key: "PRODUCT",
                type: "string",
                required: false,
                fallbackValue: "item",
              },
              { name: "legacy_name", required: true },
            ],
          });
        },
      }),
    });

    await expect(
      service.getTemplate("receipt", { userId: "user-1" }),
    ).resolves.toMatchObject({
      variables: [
        {
          key: "PRODUCT",
          name: "PRODUCT",
          type: "string",
          required: false,
          fallback_value: "item",
        },
        {
          key: "legacy_name",
          name: "legacy_name",
          type: "string",
          required: true,
          fallback_value: null,
        },
      ],
    });
  });

  it("accepts fallback_value on update and returns normalized metadata", async () => {
    const updates: Array<{ id: string; data: Partial<TemplateInsert> }> = [];
    const repository = createRepository({
      async update(id, data) {
        updates.push({ id, data });
        return [templateRow({ id, ...data })];
      },
    });

    const service = createTemplateService({ repository });
    const response = await service.updateTemplate("tmpl-1", {
      variables: [{ key: "PRODUCT", type: "string", fallback_value: "item" }],
    });

    expect(updates).toEqual([
      {
        id: "tmpl-1",
        data: {
          variables: [
            {
              name: "PRODUCT",
              key: "PRODUCT",
              type: "string",
              required: false,
              fallbackValue: "item",
            },
          ],
        },
      },
    ]);
    expect(response.variables).toMatchObject([
      {
        key: "PRODUCT",
        type: "string",
        required: false,
        fallback_value: "item",
      },
    ]);
  });

  it("converts React Email starters to editable HTML when custom HTML is saved", async () => {
    const updates: Array<{ id: string; data: Partial<TemplateInsert> }> = [];
    const repository = createRepository({
      async findByIdOrAlias() {
        return templateRow({
          html: "<!-- React Email registry template: onboarding-welcome -->",
          document: {
            rendering: {
              kind: "react_email",
              templateKey: "onboarding-welcome",
            },
          },
        });
      },
      async update(id, data) {
        updates.push({ id, data });
        return [templateRow({ id, ...data })];
      },
    });

    await createTemplateService({ repository }).updateTemplate("tmpl-1", {
      html: "<h1>Custom welcome</h1>",
    });

    expect(updates[0]?.data).toMatchObject({
      html: "<h1>Custom welcome</h1>",
      document: null,
    });
  });

  it("preserves existing variable metadata during automatic extraction", async () => {
    const updates: Array<{ id: string; data: Partial<TemplateInsert> }> = [];
    const repository = createRepository({
      async findByIdOrAlias() {
        return templateRow({
          html: "<p>{{{PRODUCT}}}</p>",
          variables: [
            {
              name: "PRODUCT",
              key: "PRODUCT",
              type: "string",
              required: true,
              fallbackValue: "item",
            },
          ],
        });
      },
      async update(id, data) {
        updates.push({ id, data });
        return [templateRow({ id, ...data })];
      },
    });

    await createTemplateService({ repository }).updateTemplate("tmpl-1", {
      html: "<p>{{{PRODUCT}}} {{{PRICE}}}</p>",
    });

    expect(updates[0]?.data.variables).toEqual([
      {
        name: "PRODUCT",
        key: "PRODUCT",
        type: "string",
        required: true,
        fallbackValue: "item",
      },
      {
        name: "PRICE",
        key: "PRICE",
        type: "string",
        required: false,
        fallbackValue: null,
      },
    ]);
  });
});

describe("template service ID-or-alias tenant scoping", () => {
  it("resolves detail and mutations through tenant-scoped ID-or-alias lookups", async () => {
    const lookups: Array<{ idOrAlias: string; userId?: string }> = [];
    const updates: Array<{ id: string; data: Partial<TemplateInsert> }> = [];
    const deletes: string[] = [];
    const repository = createRepository({
      async findByIdOrAlias(idOrAlias, userId) {
        lookups.push({ idOrAlias, userId });
        return templateRow({ id: "tmpl-real", alias: "receipt", userId });
      },
      async update(id, data) {
        updates.push({ id, data });
        return [templateRow({ id, ...data, userId: "user-1" })];
      },
      async delete(id) {
        deletes.push(id);
        return [templateRow({ id, userId: "user-1" })];
      },
    });

    const service = createTemplateService({ repository });

    await expect(
      service.getTemplate("receipt", { userId: "user-1" }),
    ).resolves.toMatchObject({ id: "tmpl-real", alias: "receipt" });
    await service.updateTemplate(
      "receipt",
      { reply_to: "reply@example.com", preview_text: "Preview" },
      { userId: "user-1" },
    );
    await service.deleteTemplate("receipt", { userId: "user-1" });

    expect(lookups).toEqual([
      { idOrAlias: "receipt", userId: "user-1" },
      { idOrAlias: "receipt", userId: "user-1" },
      { idOrAlias: "receipt", userId: "user-1" },
    ]);
    expect(updates).toEqual([
      {
        id: "tmpl-real",
        data: {
          replyTo: "reply@example.com",
          previewText: "Preview",
        },
      },
    ]);
    expect(deletes).toEqual(["tmpl-real"]);
  });

  it("returns not_found when an alias exists only outside the scoped tenant", async () => {
    const service = createTemplateService({
      repository: createRepository({
        async findByIdOrAlias() {
          return undefined;
        },
        async update() {
          throw new Error("update should not run");
        },
      }),
    });

    await expect(
      service.updateTemplate(
        "shared-alias",
        { name: "Nope" },
        { userId: "user-b" },
      ),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Template not found",
    } satisfies Partial<TemplateServiceError>);
  });
});
