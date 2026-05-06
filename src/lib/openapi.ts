type JsonSchema = {
  type?: "array" | "boolean" | "integer" | "number" | "object" | "string";
  format?: string;
  description?: string;
  enum?: readonly string[];
  items?: JsonSchema | ReferenceObject;
  properties?: Record<string, JsonSchema | ReferenceObject>;
  required?: readonly string[];
  additionalProperties?: boolean | JsonSchema | ReferenceObject;
  nullable?: boolean;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  oneOf?: readonly (JsonSchema | ReferenceObject)[];
};

type ReferenceObject = { $ref: string };

type MediaTypeObject = {
  schema: JsonSchema | ReferenceObject;
  example?: unknown;
};

type ResponseObject = {
  description: string;
  content?: Record<string, MediaTypeObject>;
};

type RequestBodyObject = {
  required?: boolean;
  content: Record<string, MediaTypeObject>;
};

type ParameterObject = {
  name: string;
  in: "header" | "path" | "query";
  required?: boolean;
  description?: string;
  schema: JsonSchema | ReferenceObject;
};

type OperationObject = {
  tags: readonly string[];
  summary: string;
  description?: string;
  operationId: string;
  security?: readonly Record<string, readonly string[]>[];
  parameters?: readonly (ParameterObject | ReferenceObject)[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject | ReferenceObject>;
};

type PathItemObject = Partial<{
  get: OperationObject;
  post: OperationObject;
  patch: OperationObject;
  delete: OperationObject;
}>;

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    license: { name: string; url: string };
  };
  servers: readonly { url: string; description: string }[];
  tags: readonly { name: string; description: string }[];
  security: readonly Record<string, readonly string[]>[];
  paths: Record<string, PathItemObject>;
  components: {
    securitySchemes: Record<
      string,
      { type: "http"; scheme: "bearer"; bearerFormat: string }
    >;
    parameters: Record<string, ParameterObject>;
    schemas: Record<string, JsonSchema | ReferenceObject>;
    responses: Record<string, ResponseObject>;
  };
};

const bearerSecurity = [{ bearerAuth: [] }] as const;

const jsonContent = (
  schema: JsonSchema | ReferenceObject,
  example?: unknown,
): Record<string, MediaTypeObject> => ({
  "application/json": example === undefined ? { schema } : { schema, example },
});

const errorResponses: Record<string, ReferenceObject> = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "422": { $ref: "#/components/responses/ValidationError" },
  "429": { $ref: "#/components/responses/RateLimited" },
  "500": { $ref: "#/components/responses/InternalServerError" },
};

const idPathParameter: ParameterObject = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const paginationParameters: readonly ReferenceObject[] = [
  { $ref: "#/components/parameters/Limit" },
  { $ref: "#/components/parameters/After" },
] as const;

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "OpenSend API",
    version: "2026-05-06",
    description:
      "Machine-readable contract for OpenSend's public API. Authenticate business endpoints with an API key using Authorization: Bearer os_xxx.",
    license: {
      name: "Elastic License 2.0",
      url: "https://www.elastic.co/licensing/elastic-license",
    },
  },
  servers: [
    { url: "https://api.opensend.com", description: "OpenSend API" },
    { url: "http://localhost:3015", description: "Local development" },
  ],
  tags: [
    {
      name: "Emails",
      description: "Send, batch send, list, and inspect emails.",
    },
    { name: "Domains", description: "Manage sending domains and DNS setup." },
    { name: "Contacts", description: "Manage audience contacts." },
  ],
  security: bearerSecurity,
  paths: {
    "/emails": {
      post: {
        tags: ["Emails"],
        summary: "Send an email",
        description:
          "Resend-compatible send alias that is rewritten to POST /api/emails by OpenSend middleware.",
        operationId: "sendEmailAlias",
        security: bearerSecurity,
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/SendEmailRequest",
          }),
        },
        responses: {
          "200": { $ref: "#/components/responses/EmailAccepted" },
          "201": { $ref: "#/components/responses/EmailAccepted" },
          "409": { $ref: "#/components/responses/IdempotencyConflict" },
          ...errorResponses,
        },
      },
    },
    "/emails/batch": {
      post: {
        tags: ["Emails"],
        summary: "Send a batch of emails",
        description:
          "Resend-compatible batch send alias that is rewritten to POST /api/emails/batch by OpenSend middleware.",
        operationId: "sendEmailBatchAlias",
        security: bearerSecurity,
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/BatchSendEmailRequest",
          }),
        },
        responses: {
          "200": { $ref: "#/components/responses/BatchEmailAccepted" },
          "202": { $ref: "#/components/responses/BatchEmailAccepted" },
          "409": { $ref: "#/components/responses/IdempotencyConflict" },
          ...errorResponses,
        },
      },
    },
    "/api/emails": {
      get: {
        tags: ["Emails"],
        summary: "List emails",
        operationId: "listEmails",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated email list.",
            content: jsonContent({ $ref: "#/components/schemas/EmailList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Emails"],
        summary: "Send an email",
        operationId: "sendEmail",
        security: bearerSecurity,
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/SendEmailRequest",
          }),
        },
        responses: {
          "200": { $ref: "#/components/responses/EmailAccepted" },
          "201": { $ref: "#/components/responses/EmailAccepted" },
          "409": { $ref: "#/components/responses/IdempotencyConflict" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/batch": {
      post: {
        tags: ["Emails"],
        summary: "Send a batch of emails",
        operationId: "sendEmailBatch",
        security: bearerSecurity,
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/BatchSendEmailRequest",
          }),
        },
        responses: {
          "200": { $ref: "#/components/responses/BatchEmailAccepted" },
          "202": { $ref: "#/components/responses/BatchEmailAccepted" },
          "409": { $ref: "#/components/responses/IdempotencyConflict" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/{id}": {
      get: {
        tags: ["Emails"],
        summary: "Retrieve an email",
        operationId: "getEmail",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Email detail.",
            content: jsonContent({ $ref: "#/components/schemas/Email" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/domains": {
      get: {
        tags: ["Domains"],
        summary: "List domains",
        operationId: "listDomains",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated domain list.",
            content: jsonContent({ $ref: "#/components/schemas/DomainList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Domains"],
        summary: "Create a domain",
        operationId: "createDomain",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateDomainRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created domain.",
            content: jsonContent({ $ref: "#/components/schemas/Domain" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/domains/{id}": {
      get: {
        tags: ["Domains"],
        summary: "Retrieve a domain",
        operationId: "getDomain",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Domain detail.",
            content: jsonContent({ $ref: "#/components/schemas/Domain" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Domains"],
        summary: "Delete a domain",
        operationId: "deleteDomain",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Domain deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/domains/{id}/auto-configure": {
      post: {
        tags: ["Domains"],
        summary: "Auto-configure DNS records",
        operationId: "autoConfigureDomain",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "DNS configuration result.",
            content: jsonContent({ $ref: "#/components/schemas/Domain" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/contacts": {
      get: {
        tags: ["Contacts"],
        summary: "List contacts",
        operationId: "listContacts",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated contact list.",
            content: jsonContent({ $ref: "#/components/schemas/ContactList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Contacts"],
        summary: "Create a contact",
        operationId: "createContact",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateContactRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created contact.",
            content: jsonContent({ $ref: "#/components/schemas/Contact" }),
          },
          ...errorResponses,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "OpenSend API key (os_xxx)",
      },
    },
    parameters: {
      Limit: {
        name: "limit",
        in: "query",
        description: "Maximum number of records to return.",
        schema: { type: "integer" },
      },
      After: {
        name: "after",
        in: "query",
        description: "Cursor for pagination.",
        schema: { type: "string" },
      },
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        description:
          "Optional idempotency key. Duplicate send keys return an idempotency_conflict error.",
        schema: { type: "string", minLength: 1, maxLength: 255 },
      },
    },
    schemas: {
      EmailRecipient: {
        oneOf: [
          { type: "string", format: "email" },
          { type: "array", items: { type: "string", format: "email" } },
        ],
      },
      EmailAttachment: {
        type: "object",
        properties: {
          filename: { type: "string" },
          content: { type: "string", description: "Base64-encoded content." },
          path: { type: "string", format: "uri" },
          content_type: { type: "string" },
          content_id: { type: "string" },
        },
        required: ["filename"],
      },
      EmailTag: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string" },
        },
        required: ["name", "value"],
      },
      TemplateReference: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          variables: { type: "object", additionalProperties: true },
        },
        required: ["id"],
      },
      SendEmailRequest: {
        type: "object",
        description: "Provide html, text, or template.",
        properties: {
          from: { type: "string", format: "email" },
          to: { $ref: "#/components/schemas/EmailRecipient" },
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
          cc: { $ref: "#/components/schemas/EmailRecipient" },
          bcc: { $ref: "#/components/schemas/EmailRecipient" },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          headers: { type: "object", additionalProperties: { type: "string" } },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailAttachment" },
          },
          tags: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailTag" },
          },
          scheduled_at: { type: "string", format: "date-time" },
          topic_id: { type: "string", format: "uuid" },
          template: { $ref: "#/components/schemas/TemplateReference" },
        },
        required: ["from", "to", "subject"],
      },
      BatchSendEmailRequest: {
        type: "array",
        items: { $ref: "#/components/schemas/SendEmailRequest" },
        maxItems: 100,
      },
      EmailAccepted: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          object: { type: "string" },
        },
        required: ["id"],
      },
      BatchEmailAccepted: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailAccepted" },
          },
        },
      },
      Email: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          from: { type: "string", format: "email" },
          to: { type: "array", items: { type: "string", format: "email" } },
          subject: { type: "string" },
          status: { type: "string" },
          last_event: {
            type: "string",
            description:
              "Current user-visible email state, including queued, sent, and failed.",
          },
          provider_retry_count: { type: "integer" },
          provider_last_attempted_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          provider_next_retry_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          provider_last_error: {
            type: "object",
            nullable: true,
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
          provider_dead_lettered_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "from", "to", "subject"],
      },
      EmailList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Email" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      DomainCapability: {
        type: "object",
        properties: {
          name: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["name", "enabled"],
      },
      CreateDomainRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          region: {
            type: "string",
            enum: ["us-east-1", "eu-west-1", "sa-east-1", "ap-northeast-1"],
          },
          custom_return_path: { type: "string" },
          open_tracking: { type: "boolean" },
          click_tracking: { type: "boolean" },
          tracking_subdomain: { type: "string" },
          tls: { type: "string", enum: ["opportunistic", "enforced"] },
          capabilities: {
            type: "array",
            items: { $ref: "#/components/schemas/DomainCapability" },
          },
        },
        required: ["name"],
      },
      Domain: {
        type: "object",
        properties: {
          object: { type: "string" },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          status: { type: "string" },
          region: { type: "string" },
          records: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          custom_return_path: { type: "string", nullable: true },
          return_path: { type: "string" },
          open_tracking: { type: "boolean" },
          click_tracking: { type: "boolean" },
          tracking_subdomain: { type: "string", nullable: true },
          tls: { type: "string" },
          capabilities: {
            type: "array",
            items: { $ref: "#/components/schemas/DomainCapability" },
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "status", "region"],
      },
      DomainList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Domain" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateContactRequest: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          first_name: { type: "string" },
          last_name: { type: "string" },
          unsubscribed: { type: "boolean" },
          properties: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          segments: { type: "array", items: { type: "string" } },
        },
        required: ["email"],
      },
      Contact: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          first_name: { type: "string", nullable: true },
          last_name: { type: "string", nullable: true },
          unsubscribed: { type: "boolean" },
          properties: { type: "object", additionalProperties: true },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "email"],
      },
      ContactList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Contact" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      DeleteResponse: {
        type: "object",
        properties: { deleted: { type: "boolean" } },
        required: ["deleted"],
      },
      ErrorEnvelope: {
        type: "object",
        description: "Common public API error envelope.",
        properties: {
          name: { type: "string" },
          code: { type: "string" },
          message: { type: "string" },
          statusCode: { type: "integer" },
          details: { type: "object", additionalProperties: true },
        },
        required: ["name", "code", "message", "statusCode"],
      },
    },
    responses: {
      EmailAccepted: {
        description: "Email accepted for delivery or scheduling.",
        content: jsonContent({ $ref: "#/components/schemas/EmailAccepted" }),
      },
      BatchEmailAccepted: {
        description: "Batch accepted for delivery or scheduling.",
        content: jsonContent({
          $ref: "#/components/schemas/BatchEmailAccepted",
        }),
      },
      BadRequest: {
        description: "Invalid JSON or request parameters.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      Unauthorized: {
        description: "Missing, malformed, or invalid API key.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      ValidationError: {
        description: "Request validation failed.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      RateLimited: {
        description: "Rate limit exceeded.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      IdempotencyConflict: {
        description: "An idempotency key was already accepted.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      NotFound: {
        description: "Resource not found.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      InternalServerError: {
        description: "Unexpected server error.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
    },
  },
} as const satisfies OpenApiDocument;
