import { templateRepo } from "../db/repositories/templateRepo";
import type { templates } from "../db/schema";

type TemplateRow = typeof templates.$inferSelect;
type TemplateInsert = typeof templates.$inferInsert;

type TemplateVariableType = "string" | "number";
type TemplateFallbackValue = string | number;

type StoredTemplateVariable = {
  name: string;
  key?: string;
  type?: TemplateVariableType;
  required: boolean;
  fallbackValue?: TemplateFallbackValue | null;
  fallback_value?: TemplateFallbackValue | null;
};

type NormalizedTemplateVariable = {
  key: string;
  name: string;
  type: TemplateVariableType;
  required: boolean;
  fallbackValue: TemplateFallbackValue | null;
  hasFallbackValue: boolean;
};

export type TemplateVariableResponseItem = {
  id: string;
  key: string;
  name: string;
  type: TemplateVariableType;
  required: boolean;
  fallback_value: TemplateFallbackValue | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export type TemplateListItem = Pick<
  TemplateRow,
  | "id"
  | "name"
  | "alias"
  | "status"
  | "currentVersionId"
  | "publishedAt"
  | "hasUnpublishedVersions"
  | "createdAt"
>;

export type TemplateListResult = {
  data: TemplateListItem[];
  total: number;
};

export type TemplateDetail = Pick<
  TemplateRow,
  | "id"
  | "name"
  | "alias"
  | "status"
  | "subject"
  | "from"
  | "replyTo"
  | "previewText"
  | "html"
  | "text"
  | "createdAt"
> & {
  variables: TemplateVariableResponseItem[];
  updatedAt: TemplateRow["createdAt"];
};

export type TemplateCreateResult = Pick<TemplateRow, "id" | "name" | "alias">;

export type TemplateDuplicateResult = Pick<
  TemplateRow,
  "id" | "name" | "status"
>;

export type TemplatePublishResult = Pick<
  TemplateRow,
  "id" | "status" | "publishedAt" | "hasUnpublishedVersions"
>;

type TemplateListOptions = {
  search?: string;
  status?: string;
  userId?: string;
};

type TemplateCreateOptions = {
  userId?: string;
};

export type TemplateServiceErrorCode =
  | "invalid_input"
  | "invalid_variables"
  | "not_draft"
  | "not_found";

export class TemplateServiceError extends Error {
  constructor(
    readonly code: TemplateServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TemplateServiceError";
  }
}

export type TemplateRepository = {
  findById(id: string): Promise<TemplateRow | undefined>;
  create(data: TemplateInsert): Promise<TemplateRow[]>;
  update(id: string, data: Partial<TemplateInsert>): Promise<TemplateRow[]>;
  delete(id: string): Promise<TemplateRow[]>;
  listForApi(options: {
    search?: string;
    status?: string;
    userId?: string;
  }): Promise<TemplateListResult>;
};

export type TemplateServiceDependencies = {
  repository?: TemplateRepository;
  now?: () => Date;
};

const RESERVED_VARIABLE_NAMES = new Set([
  "FIRST_NAME",
  "LAST_NAME",
  "EMAIL",
  "UNSUBSCRIBE_URL",
  "RESEND_UNSUBSCRIBE_URL",
  "INTERNAL_ID",
  "CONTACT",
  "THIS",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isTemplateVariableType(value: unknown): value is TemplateVariableType {
  return value === "string" || value === "number";
}

function isFallbackValue(value: unknown): value is TemplateFallbackValue {
  return typeof value === "string" || typeof value === "number";
}

function getRawFallbackValue(record: Record<string, unknown>): unknown {
  if (hasOwn(record, "fallbackValue")) return record.fallbackValue;
  if (hasOwn(record, "fallback_value")) return record.fallback_value;
  return undefined;
}

function getRawKey(record: Record<string, unknown>): unknown {
  if (typeof record.key === "string") return record.key;
  if (typeof record.name === "string") return record.name;
  return undefined;
}

function normalizeTemplateVariableInput(
  value: unknown,
):
  | { ok: true; variable: StoredTemplateVariable }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "variables must contain objects" };
  }

  const rawKey = getRawKey(value);
  if (typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return { ok: false, error: "Variable key is required." };
  }

  const key = rawKey.trim();
  if (RESERVED_VARIABLE_NAMES.has(key.toUpperCase())) {
    return { ok: false, error: `Variable name ${key} is reserved.` };
  }

  if (value.type !== undefined && !isTemplateVariableType(value.type)) {
    return {
      ok: false,
      error: `Variable ${key} type must be either string or number.`,
    };
  }

  const rawFallbackValue = getRawFallbackValue(value);
  const hasFallbackValue =
    rawFallbackValue !== undefined && rawFallbackValue !== null;
  if (hasFallbackValue && !isFallbackValue(rawFallbackValue)) {
    return {
      ok: false,
      error: `Variable ${key} fallback value must be a string or number.`,
    };
  }

  if (value.required !== undefined && typeof value.required !== "boolean") {
    return {
      ok: false,
      error: `Variable ${key} required must be a boolean.`,
    };
  }

  const isResendStyle =
    hasOwn(value, "key") ||
    hasOwn(value, "type") ||
    hasOwn(value, "fallbackValue") ||
    hasOwn(value, "fallback_value");
  const required =
    typeof value.required === "boolean"
      ? value.required
      : isResendStyle
        ? !hasFallbackValue
        : false;

  return {
    ok: true,
    variable: {
      name: key,
      key,
      type: isTemplateVariableType(value.type) ? value.type : "string",
      required,
      fallbackValue: hasFallbackValue ? rawFallbackValue : null,
    },
  };
}

function normalizeTemplateVariablesInput(
  value: unknown,
):
  | { ok: true; variables: StoredTemplateVariable[] }
  | { ok: false; error: string } {
  const variables = value ?? [];
  if (!Array.isArray(variables)) {
    return { ok: false, error: "variables must be an array" };
  }

  if (variables.length > 50) {
    return { ok: false, error: "Too many variables. Max allowed is 50." };
  }

  const normalized: StoredTemplateVariable[] = [];
  for (const variable of variables) {
    const result = normalizeTemplateVariableInput(variable);
    if (!result.ok) return result;
    normalized.push(result.variable);
  }

  return { ok: true, variables: normalized };
}

function normalizeStoredTemplateVariable(
  value: unknown,
): NormalizedTemplateVariable | null {
  if (!isRecord(value)) return null;

  const rawKey = getRawKey(value);
  if (typeof rawKey !== "string" || rawKey.trim().length === 0) return null;

  const rawFallbackValue = getRawFallbackValue(value);
  const hasFallbackValue = isFallbackValue(rawFallbackValue);

  return {
    key: rawKey.trim(),
    name: rawKey.trim(),
    type: isTemplateVariableType(value.type) ? value.type : "string",
    required: typeof value.required === "boolean" ? value.required : false,
    fallbackValue: hasFallbackValue ? rawFallbackValue : null,
    hasFallbackValue,
  };
}

function normalizeStoredTemplateVariables(
  value: unknown,
): NormalizedTemplateVariable[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((variable) => normalizeStoredTemplateVariable(variable))
    .filter((variable): variable is NormalizedTemplateVariable =>
      Boolean(variable),
    );
}

function templateVariableResponse(
  variable: NormalizedTemplateVariable,
  index: number,
  timestamps: {
    createdAt: Date | string | null;
    updatedAt?: Date | string | null;
  },
): TemplateVariableResponseItem {
  return {
    id: `var-${index}`,
    key: variable.key,
    name: variable.name,
    type: variable.type,
    required: variable.required,
    fallback_value: variable.fallbackValue,
    created_at: timestamps.createdAt,
    updated_at: timestamps.updatedAt ?? timestamps.createdAt,
  };
}

function extractTemplateVariables(content: string): string[] {
  const regex = /{{{\s*([a-zA-Z0-9_-]+)\s*}}}|{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(content);

  while (match !== null) {
    const variableName = match[1] ?? match[2];
    if (variableName) variables.add(variableName);
    match = regex.exec(content);
  }

  return Array.from(variables);
}

function toTruthyStoredString(value: unknown): string | null {
  return value ? (value as string) : null;
}

function generateAlias(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-template"
  );
}

function normalizeVariablesOrThrow(value: unknown): StoredTemplateVariable[] {
  const variableResult = normalizeTemplateVariablesInput(value);
  if (!variableResult.ok) {
    throw new TemplateServiceError("invalid_variables", variableResult.error);
  }
  return variableResult.variables;
}

function toTemplateDetail(row: TemplateRow): TemplateDetail {
  return {
    id: row.id,
    name: row.name,
    alias: row.alias,
    status: row.status,
    subject: row.subject,
    from: row.from,
    replyTo: row.replyTo,
    previewText: row.previewText,
    html: row.html,
    text: row.text,
    variables: normalizeStoredTemplateVariables(row.variables).map(
      (variable, index) =>
        templateVariableResponse(variable, index, {
          createdAt: row.createdAt,
        }),
    ),
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  };
}

function buildAutomaticVariables(
  existing: TemplateRow,
  body: Record<string, unknown>,
): StoredTemplateVariable[] {
  const fullContent = `${body.subject ?? existing.subject ?? ""} ${body.html ?? existing.html ?? ""} ${body.text ?? existing.text ?? ""}`;
  const extracted = extractTemplateVariables(fullContent);
  const currentVars = normalizeStoredTemplateVariables(existing.variables);
  const varMap = new Map(
    currentVars.map((variable) => [variable.key, variable]),
  );

  return extracted.map((name) => ({
    name,
    key: name,
    type: varMap.get(name)?.type ?? "string",
    required: varMap.get(name)?.required ?? false,
    fallbackValue: varMap.get(name)?.fallbackValue ?? null,
  }));
}

export function createTemplateService({
  repository = templateRepo,
  now = () => new Date(),
}: TemplateServiceDependencies = {}) {
  return {
    async listTemplates(
      options: TemplateListOptions,
    ): Promise<TemplateListResult> {
      const search = options.search?.trim() || "";
      const rawStatus = options.status?.trim() || "";
      const status =
        rawStatus === "published" || rawStatus === "draft" ? rawStatus : "";

      return await repository.listForApi({
        search,
        status,
        userId: options.userId,
      });
    },

    async createTemplate(
      input: unknown,
      options: TemplateCreateOptions = {},
    ): Promise<TemplateCreateResult> {
      const body = asRecord(input);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const html = typeof body.html === "string" ? body.html.trim() : "";

      if (!name || !html) {
        throw new TemplateServiceError(
          "invalid_input",
          "name and html are required",
        );
      }

      const alias =
        typeof body.alias === "string" && body.alias.trim()
          ? body.alias.trim()
          : generateAlias(name);

      const createData: TemplateInsert = {
        name,
        alias,
        html,
        subject: toTruthyStoredString(body.subject),
        from: toTruthyStoredString(body.from),
        replyTo: toTruthyStoredString(body.reply_to),
        previewText: toTruthyStoredString(body.preview_text),
        text: toTruthyStoredString(body.text),
        variables: normalizeVariablesOrThrow(body.variables),
        status: "draft",
      };
      if (options.userId) createData.userId = options.userId;

      const [template] = await repository.create(createData);

      return {
        id: template.id,
        name: template.name,
        alias: template.alias,
      };
    },

    async getTemplate(id: string): Promise<TemplateDetail> {
      const template = await repository.findById(id);
      if (!template) {
        throw new TemplateServiceError("not_found", "Template not found");
      }

      return toTemplateDetail(template);
    },

    async updateTemplate(id: string, input: unknown): Promise<TemplateDetail> {
      const body = asRecord(input);
      const updateData: Partial<TemplateInsert> = {};

      if (body.name !== undefined) {
        updateData.name = body.name as TemplateInsert["name"];
      }
      if (body.alias !== undefined) {
        updateData.alias = body.alias as TemplateInsert["alias"];
      }
      if (body.status !== undefined) {
        updateData.status = body.status as TemplateInsert["status"];
      }
      if (body.subject !== undefined) {
        updateData.subject = body.subject as TemplateInsert["subject"];
      }
      if (body.from !== undefined) {
        updateData.from = body.from as TemplateInsert["from"];
      }
      if (body.replyTo !== undefined) {
        updateData.replyTo = body.replyTo as TemplateInsert["replyTo"];
      }
      if (body.previewText !== undefined) {
        updateData.previewText =
          body.previewText as TemplateInsert["previewText"];
      }
      if (body.html !== undefined) {
        updateData.html = body.html as TemplateInsert["html"];
      }
      if (body.text !== undefined) {
        updateData.text = body.text as TemplateInsert["text"];
      }

      if (body.html !== undefined || body.subject !== undefined) {
        const existing = await repository.findById(id);
        if (existing) {
          updateData.variables = buildAutomaticVariables(existing, body);
        }
      }

      if (body.variables !== undefined) {
        updateData.variables = normalizeVariablesOrThrow(body.variables);
      }

      const [updated] = await repository.update(id, updateData);
      if (!updated) {
        throw new TemplateServiceError("not_found", "Template not found");
      }

      return toTemplateDetail(updated);
    },

    async deleteTemplate(id: string): Promise<void> {
      const [deleted] = await repository.delete(id);
      if (!deleted) {
        throw new TemplateServiceError("not_found", "Template not found");
      }
    },

    async duplicateTemplate(id: string): Promise<TemplateDuplicateResult> {
      const existing = await repository.findById(id);
      if (!existing) {
        throw new TemplateServiceError("not_found", "Template not found");
      }

      const [duplicated] = await repository.create({
        name: `${existing.name} (Copy)`,
        alias: existing.alias ? `${existing.alias}-copy` : null,
        status: "draft",
        subject: existing.subject,
        from: existing.from,
        replyTo: existing.replyTo,
        previewText: existing.previewText,
        html: existing.html,
        text: existing.text,
        variables: existing.variables,
      });

      return {
        id: duplicated.id,
        name: duplicated.name,
        status: duplicated.status,
      };
    },

    async publishTemplate(id: string): Promise<TemplatePublishResult> {
      const existing = await repository.findById(id);
      if (!existing) {
        throw new TemplateServiceError("not_found", "Template not found");
      }

      if (existing.status !== "draft") {
        throw new TemplateServiceError(
          "not_draft",
          "Only draft templates can be published",
        );
      }

      const [updated] = await repository.update(id, {
        status: "published",
        publishedAt: now(),
        hasUnpublishedVersions: false,
      });
      if (!updated) {
        throw new TemplateServiceError("not_found", "Template not found");
      }

      return {
        id: updated.id,
        status: updated.status,
        publishedAt: updated.publishedAt,
        hasUnpublishedVersions: updated.hasUnpublishedVersions,
      };
    },
  };
}

export const templateService = createTemplateService();
