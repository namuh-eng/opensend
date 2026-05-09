import { z } from "zod";

const eventNameSchema = z.string().min(1).max(255);
const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().min(3).max(512);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const supportedEventSchemaTypes = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
] as const;

type EventSchemaType = (typeof supportedEventSchemaTypes)[number];

export interface EventSchemaIssue {
  path: string;
  message: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedEventSchemaType(value: unknown): value is EventSchemaType {
  return (
    typeof value === "string" &&
    supportedEventSchemaTypes.includes(value as EventSchemaType)
  );
}

function pushIssue(
  issues: EventSchemaIssue[],
  path: string[],
  message: string,
) {
  issues.push({ path: path.join("."), message });
}

function validateRequiredList(
  value: unknown,
  path: string[],
  issues: EventSchemaIssue[],
) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    pushIssue(issues, path, `${path.join(".")} must be an array of strings`);
    return;
  }

  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      pushIssue(
        issues,
        [...path, String(index)],
        `${[...path, String(index)].join(".")} must be a non-empty string`,
      );
    }
  });
}

function validatePropertiesObject(
  value: unknown,
  path: string[],
  issues: EventSchemaIssue[],
) {
  if (value === undefined) return;
  if (!isRecord(value)) {
    pushIssue(issues, path, `${path.join(".")} must be an object`);
    return;
  }

  for (const [propertyName, descriptor] of Object.entries(value)) {
    if (propertyName.trim().length === 0) {
      pushIssue(
        issues,
        [...path, propertyName],
        `${path.join(".")} keys must be non-empty strings`,
      );
      continue;
    }
    validatePropertyDescriptor(descriptor, [...path, propertyName], issues);
  }
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  path: string[],
  allowedKeys: ReadonlySet<string>,
  issues: EventSchemaIssue[],
) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      pushIssue(
        issues,
        [...path, key],
        `${[...path, key].join(".")} is not a supported schema keyword`,
      );
    }
  }
}

function validatePropertyDescriptor(
  value: unknown,
  path: string[],
  issues: EventSchemaIssue[],
) {
  if (!isRecord(value)) {
    pushIssue(issues, path, `${path.join(".")} must be an object descriptor`);
    return;
  }

  validateAllowedKeys(
    value,
    path,
    new Set(["type", "properties", "required"]),
    issues,
  );

  if (!isSupportedEventSchemaType(value.type)) {
    pushIssue(
      issues,
      [...path, "type"],
      `${[...path, "type"].join(".")} must be one of: ${supportedEventSchemaTypes.join(", ")}`,
    );
    return;
  }

  if (value.type !== "object") {
    if (value.properties !== undefined) {
      pushIssue(
        issues,
        [...path, "properties"],
        `${[...path, "properties"].join(".")} is only supported when type is "object"`,
      );
    }
    if (value.required !== undefined) {
      pushIssue(
        issues,
        [...path, "required"],
        `${[...path, "required"].join(".")} is only supported when type is "object"`,
      );
    }
    return;
  }

  validatePropertiesObject(value.properties, [...path, "properties"], issues);
  validateRequiredList(value.required, [...path, "required"], issues);
}

export function validateCustomEventSchemaDefinition(
  schema: Record<string, unknown>,
): EventSchemaIssue[] {
  const issues: EventSchemaIssue[] = [];
  validateAllowedKeys(
    schema,
    ["schema"],
    new Set(["type", "properties", "required"]),
    issues,
  );

  if (schema.type !== "object") {
    pushIssue(issues, ["schema", "type"], 'schema.type must be "object"');
    return issues;
  }

  validatePropertiesObject(schema.properties, ["schema", "properties"], issues);
  validateRequiredList(schema.required, ["schema", "required"], issues);
  return issues;
}

const eventSchemaDefinitionSchema = jsonObjectSchema.superRefine(
  (schema, ctx) => {
    for (const issue of validateCustomEventSchemaDefinition(schema)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: issue.path.split(".").slice(1),
        message: issue.message,
      });
    }
  },
);

export const createCustomEventSchema = z.object({
  name: eventNameSchema,
  schema: eventSchemaDefinitionSchema.optional(),
});

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().min(1).optional(),
});

export const sendEventSchema = z
  .object({
    event: eventNameSchema,
    contact_id: uuidSchema.optional(),
    contactId: uuidSchema.optional(),
    email: emailSchema.optional(),
    payload: jsonObjectSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.contact_id !== undefined &&
      data.contactId !== undefined &&
      data.contact_id !== data.contactId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactId"],
        message: "contactId and contact_id must match when both are provided",
      });
      return;
    }

    const hasContactId =
      data.contact_id !== undefined || data.contactId !== undefined;
    const hasEmail = data.email !== undefined;

    if (hasContactId === hasEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasEmail ? ["email"] : ["contact_id"],
        message:
          "provide exactly one contact identifier: contact_id/contactId or email",
      });
    }
  });

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function valueMatchesType(value: unknown, type: EventSchemaType): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isRecord(value);
    case "array":
      return Array.isArray(value);
  }
}

function validateObjectPayload(
  payload: Record<string, unknown>,
  schema: Record<string, unknown>,
  path: string[],
  issues: EventSchemaIssue[],
) {
  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];

  for (const field of required) {
    if (!hasOwn(payload, field)) {
      pushIssue(
        issues,
        [...path, field],
        `Missing required field ${[...path, field].join(".")}`,
      );
    }
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  for (const [field, descriptor] of Object.entries(properties)) {
    if (!hasOwn(payload, field)) continue;
    if (!isRecord(descriptor) || !isSupportedEventSchemaType(descriptor.type)) {
      continue;
    }

    const value = payload[field];
    const fieldPath = [...path, field];
    if (!valueMatchesType(value, descriptor.type)) {
      pushIssue(
        issues,
        fieldPath,
        `Expected ${fieldPath.join(".")} to be "${descriptor.type}"`,
      );
      continue;
    }

    if (descriptor.type === "object" && isRecord(value)) {
      validateObjectPayload(value, descriptor, fieldPath, issues);
    }
  }
}

export function validateEventPayloadAgainstSchema(
  payload: Record<string, unknown>,
  schema: Record<string, unknown>,
): EventSchemaIssue[] {
  const schemaIssues = validateCustomEventSchemaDefinition(schema);
  if (schemaIssues.length > 0) return schemaIssues;

  const issues: EventSchemaIssue[] = [];
  validateObjectPayload(payload, schema, ["payload"], issues);
  return issues;
}

export type CreateCustomEventRequest = z.infer<typeof createCustomEventSchema>;
export type SendEventRequest = z.infer<typeof sendEventSchema>;
