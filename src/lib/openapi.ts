type JsonSchema = {
  type?: "array" | "boolean" | "integer" | "number" | "object" | "string";
  format?: string;
  description?: string;
  pattern?: string;
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

const emailIdPathParameter: ParameterObject = {
  name: "email_id",
  in: "path",
  required: true,
  description: "Scheduled email ID to cancel.",
  schema: { type: "string", format: "uuid" },
};

const templateIdOrAliasPathParameter: ParameterObject = {
  name: "id",
  in: "path",
  required: true,
  description: "Template ID or alias.",
  schema: { type: "string" },
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
    {
      name: "Templates",
      description:
        "Create, list, update, publish, duplicate, and delete stored templates.",
    },
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
          ...errorResponses,
        },
      },
    },
    "/emails/{email_id}/cancel": {
      post: {
        tags: ["Emails"],
        summary: "Cancel a scheduled email",
        description:
          "Resend-compatible endpoint to cancel a scheduled email before it is sent.",
        operationId: "cancelEmailAlias",
        security: bearerSecurity,
        parameters: [emailIdPathParameter],
        responses: {
          "200": { $ref: "#/components/responses/EmailCanceled" },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/templates": {
      get: {
        tags: ["Templates"],
        summary: "List templates",
        description:
          "Resend-compatible root collection. Browser dashboard GET /templates remains a signed-in dashboard page; API-like requests are rewritten to this public JSON contract.",
        operationId: "listTemplatesAlias",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Template list.",
            content: jsonContent({ $ref: "#/components/schemas/TemplateList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Templates"],
        summary: "Create a template",
        operationId: "createTemplateAlias",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateTemplateRequest",
          }),
        },
        responses: {
          "201": { $ref: "#/components/responses/TemplateMutation" },
          ...errorResponses,
        },
      },
    },
    "/templates/{id}": {
      get: {
        tags: ["Templates"],
        summary: "Retrieve a template by ID or alias",
        operationId: "getTemplateAlias",
        security: bearerSecurity,
        parameters: [templateIdOrAliasPathParameter],
        responses: {
          "200": {
            description: "Template detail.",
            content: jsonContent({ $ref: "#/components/schemas/Template" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Templates"],
        summary: "Update a template by ID or alias",
        operationId: "updateTemplateAlias",
        security: bearerSecurity,
        parameters: [templateIdOrAliasPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateTemplateRequest",
          }),
        },
        responses: {
          "200": { $ref: "#/components/responses/TemplateMutation" },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Templates"],
        summary: "Delete a template by ID or alias",
        operationId: "deleteTemplateAlias",
        security: bearerSecurity,
        parameters: [templateIdOrAliasPathParameter],
        responses: {
          "200": {
            description: "Template deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteTemplateResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/templates/{id}/publish": {
      post: {
        tags: ["Templates"],
        summary: "Publish a draft template by ID or alias",
        operationId: "publishTemplateAlias",
        security: bearerSecurity,
        parameters: [templateIdOrAliasPathParameter],
        responses: {
          "200": { $ref: "#/components/responses/TemplateMutation" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/templates/{id}/duplicate": {
      post: {
        tags: ["Templates"],
        summary: "Duplicate a template by ID or alias",
        operationId: "duplicateTemplateAlias",
        security: bearerSecurity,
        parameters: [templateIdOrAliasPathParameter],
        responses: {
          "200": { $ref: "#/components/responses/TemplateMutation" },
          "404": { $ref: "#/components/responses/NotFound" },
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
          "Optional idempotency key, up to 256 characters. Duplicate single and batch send keys within 24 hours return the original accepted response without creating duplicate emails; after 24 hours the same key is accepted as a new request.",
        schema: { type: "string", minLength: 1, maxLength: 256 },
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
        description:
          "Resend-compatible attachment. Provide content or an http(s) path. Total attachments are limited to 40MB per email after Base64 encoding.",
        properties: {
          filename: { type: "string" },
          content: { type: "string", description: "Base64-encoded content." },
          path: {
            type: "string",
            format: "uri",
            description: "HTTP(S) URL where the attachment file is hosted.",
          },
          content_type: {
            type: "string",
            description:
              "MIME content type to emit for the attachment. Falls back to filename-derived/default type.",
          },
          content_id: {
            type: "string",
            description:
              "Content-ID for inline CID references such as cid:logo.",
          },
        },
        required: ["filename"],
      },
      EmailTag: {
        type: "object",
        properties: {
          name: {
            type: "string",
            maxLength: 256,
            pattern: "^[A-Za-z0-9_-]+$",
          },
          value: {
            type: "string",
            maxLength: 256,
            pattern: "^[A-Za-z0-9_-]*$",
          },
        },
        required: ["name", "value"],
      },
      TemplateVariable: {
        type: "object",
        properties: {
          key: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["string", "number"] },
          required: { type: "boolean" },
          fallback_value: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        required: ["key"],
      },
      CreateTemplateRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          alias: { type: "string", nullable: true },
          from: { type: "string", nullable: true },
          subject: { type: "string", nullable: true },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          html: { type: "string" },
          text: { type: "string", nullable: true },
          variables: {
            type: "array",
            items: { $ref: "#/components/schemas/TemplateVariable" },
          },
        },
        required: ["name", "html"],
      },
      UpdateTemplateRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          alias: { type: "string", nullable: true },
          status: { type: "string", enum: ["draft", "published"] },
          from: { type: "string", nullable: true },
          subject: { type: "string", nullable: true },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          html: { type: "string" },
          text: { type: "string", nullable: true },
          variables: {
            type: "array",
            items: { $ref: "#/components/schemas/TemplateVariable" },
          },
        },
      },
      TemplateMutationResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["template"] },
          id: { type: "string" },
        },
        required: ["object", "id"],
      },
      Template: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["template"] },
          id: { type: "string" },
          name: { type: "string" },
          alias: { type: "string", nullable: true },
          status: { type: "string", enum: ["draft", "published"] },
          subject: { type: "string", nullable: true },
          from: { type: "string", nullable: true },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          preview_text: { type: "string", nullable: true },
          html: { type: "string", nullable: true },
          text: { type: "string", nullable: true },
          variables: {
            type: "array",
            items: { $ref: "#/components/schemas/TemplateVariable" },
          },
          current_version_id: { type: "string", nullable: true },
          published_at: { type: "string", format: "date-time", nullable: true },
          has_unpublished_versions: { type: "boolean" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["object", "id", "name", "status"],
      },
      TemplateList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Template" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      DeleteTemplateResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["template"] },
          id: { type: "string" },
          deleted: { type: "boolean" },
        },
        required: ["object", "id", "deleted"],
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
            description:
              "Maximum total size is 40MB per email after Base64 encoding.",
            items: { $ref: "#/components/schemas/EmailAttachment" },
          },
          tags: {
            type: "array",
            maxItems: 75,
            items: { $ref: "#/components/schemas/EmailTag" },
          },
          scheduled_at: {
            type: "string",
            description:
              "Schedule delivery with a future ISO 8601 date-time including timezone, or the supported Resend-compatible natural language form `in <positive integer> <minute|min|minutes|hour|hours|day|days>`. Values must be within 30 days.",
          },
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
      EmailCanceled: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["email"] },
          id: { type: "string", format: "uuid" },
        },
        required: ["object", "id"],
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
          tracking_subdomain: {
            type: "string",
            description:
              "Single DNS label for branded tracking URLs, for example links.",
            maxLength: 63,
          },
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
      EmailCanceled: {
        description: "Scheduled email canceled.",
        content: jsonContent({
          $ref: "#/components/schemas/EmailCanceled",
        }),
      },
      TemplateMutation: {
        description: "Template mutation accepted.",
        content: jsonContent({
          $ref: "#/components/schemas/TemplateMutationResponse",
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
