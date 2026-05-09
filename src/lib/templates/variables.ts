export type TemplateVariableType = "string" | "number";

export type TemplateFallbackValue = string | number;

export type StoredTemplateVariable = {
  name: string;
  key?: string;
  type?: TemplateVariableType;
  required: boolean;
  fallbackValue?: TemplateFallbackValue | null;
  fallback_value?: TemplateFallbackValue | null;
};

export type NormalizedTemplateVariable = {
  key: string;
  name: string;
  type: TemplateVariableType;
  required: boolean;
  fallbackValue: TemplateFallbackValue | null;
  hasFallbackValue: boolean;
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

export function isReservedTemplateVariableName(name: string): boolean {
  return RESERVED_VARIABLE_NAMES.has(name.toUpperCase());
}

export function normalizeTemplateVariableInput(
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
  if (isReservedTemplateVariableName(key)) {
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

export function normalizeTemplateVariablesInput(
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

export function normalizeStoredTemplateVariable(
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

export function normalizeStoredTemplateVariables(
  value: unknown,
): NormalizedTemplateVariable[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((variable) => normalizeStoredTemplateVariable(variable))
    .filter((variable): variable is NormalizedTemplateVariable =>
      Boolean(variable),
    );
}

export function templateVariableResponse(
  variable: NormalizedTemplateVariable,
  index: number,
  timestamps: {
    createdAt: Date | string | null;
    updatedAt?: Date | string | null;
  },
) {
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function interpolateTemplateVariables(
  content: string,
  variables: Record<string, unknown>,
): string {
  let rendered = content;
  for (const [key, value] of Object.entries(variables)) {
    const escapedKey = escapeRegex(key);
    const regex = new RegExp(
      `{{{\\s*${escapedKey}\\s*}}}|{{\\s*${escapedKey}\\s*}}`,
      "g",
    );
    rendered = rendered.replace(regex, String(value));
  }
  return rendered;
}
