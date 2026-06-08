type JsonSchema = {
  type?:
    | "array"
    | "boolean"
    | "integer"
    | "number"
    | "null"
    | "object"
    | "string";
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
  put: OperationObject;
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

const automationIdPathParameter: ParameterObject = {
  name: "automation_id",
  in: "path",
  required: true,
  description: "Automation ID.",
  schema: { type: "string", format: "uuid" },
};

const automationRunIdPathParameter: ParameterObject = {
  name: "run_id",
  in: "path",
  required: true,
  description: "Automation run ID.",
  schema: { type: "string", format: "uuid" },
};

const emailIdPathParameter: ParameterObject = {
  name: "email_id",
  in: "path",
  required: true,
  description: "Scheduled email ID to cancel.",
  schema: { type: "string", format: "uuid" },
};

const contactIdPathParameter: ParameterObject = {
  name: "contact_id",
  in: "path",
  required: true,
  description: "Contact ID or email address.",
  schema: { type: "string" },
};

const contactSegmentIdPathParameter: ParameterObject = {
  name: "segment_id",
  in: "path",
  required: true,
  description: "Segment ID for the authenticated tenant.",
  schema: { type: "string", format: "uuid" },
};

const audienceIdPathParameter: ParameterObject = {
  name: "audience_id",
  in: "path",
  required: true,
  description: "Audience ID.",
  schema: { type: "string" },
};

const apiKeyIdPathParameter: ParameterObject = {
  name: "id",
  in: "path",
  required: true,
  description: "API key ID.",
  schema: { type: "string" },
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
    { url: "https://opensend.namuh.co", description: "OpenSend API" },
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
    { name: "API Keys", description: "Manage API keys for your account." },
    {
      name: "Segments",
      description: "Create and manage audience segments.",
    },
    {
      name: "Topics",
      description: "Create and manage subscription topics.",
    },
    {
      name: "Properties",
      description: "Create and manage custom contact properties.",
    },
    {
      name: "Broadcasts",
      description: "Create, schedule, and send email broadcasts.",
    },
    {
      name: "Automations",
      description: "Create and manage email automations and their runs.",
    },
    {
      name: "Webhooks",
      description: "Create and manage webhook endpoints and deliveries.",
    },
    {
      name: "Suppressions",
      description: "List and remove suppressed email addresses.",
    },
    {
      name: "Logs",
      description: "Inspect API request logs.",
    },
    {
      name: "Events",
      description: "Define and send custom events that trigger automations.",
    },
    {
      name: "Receiving",
      description: "Retrieve inbound emails received by your domains.",
    },
    {
      name: "Dedicated IPs",
      description:
        "Create and manage dedicated IP pools for improved deliverability.",
    },
    {
      name: "Unsubscribe Page",
      description:
        "Customize the public unsubscribe confirmation page shown to contacts.",
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
    // ── Emails extended ───────────────────────────────────────────
    "/api/emails/{id}": {
      get: {
        tags: ["Emails"],
        summary: "Retrieve an email by ID (canonical)",
        operationId: "getEmailById",
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
      patch: {
        tags: ["Emails"],
        summary: "Update a scheduled email",
        description:
          "Update the scheduled_at time of a not-yet-sent scheduled email. Only the scheduled_at field is currently updatable.",
        operationId: "updateEmail",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateEmailRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated email.",
            content: jsonContent({ $ref: "#/components/schemas/Email" }),
          },
          "400": { $ref: "#/components/responses/BadRequest" },
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
        parameters: [
          ...paginationParameters,
          {
            name: "status",
            in: "query",
            description: "Filter by email status.",
            schema: { type: "string" },
          },
          {
            name: "before",
            in: "query",
            description: "Cursor for reverse pagination.",
            schema: { type: "string" },
          },
        ],
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
      delete: {
        tags: ["Emails"],
        summary: "Delete an email record",
        description:
          "Delete an email record by ID passed as a query parameter.",
        operationId: "deleteEmail",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            description: "Email ID to delete.",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Email deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
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
    "/api/emails/{id}/cancel": {
      post: {
        tags: ["Emails"],
        summary: "Cancel a scheduled email",
        operationId: "cancelEmail",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": { $ref: "#/components/responses/EmailCanceled" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/{id}/events": {
      get: {
        tags: ["Emails"],
        summary: "List events for an email",
        operationId: "listEmailEvents",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "List of delivery events for the email.",
            content: jsonContent({
              $ref: "#/components/schemas/EmailEventList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/{id}/trace": {
      get: {
        tags: ["Emails"],
        summary: "List the chronological trace for an email",
        operationId: "listEmailTrace",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description:
              "Chronological trace entries for request, queue, provider, webhook, and suppression evidence.",
            content: jsonContent({
              $ref: "#/components/schemas/EmailTrace",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/{id}/attachments": {
      get: {
        tags: ["Emails"],
        summary: "List attachments for an email",
        operationId: "listEmailAttachments",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "List of attachments for the email.",
            content: jsonContent({
              $ref: "#/components/schemas/EmailAttachmentList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/{id}/attachments/{attachmentId}": {
      get: {
        tags: ["Emails"],
        summary: "Retrieve a single attachment for an email",
        operationId: "getEmailAttachment",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "attachmentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Attachment detail.",
            content: jsonContent({
              $ref: "#/components/schemas/EmailAttachmentDetail",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Receiving ─────────────────────────────────────────────────
    "/api/emails/receiving": {
      get: {
        tags: ["Receiving"],
        summary: "List received (inbound) emails",
        operationId: "listReceivedEmails",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "to",
            in: "query",
            description: "Filter by recipient address.",
            schema: { type: "string", format: "email" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of received emails.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivedEmailList",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/emails/receiving/{id}": {
      get: {
        tags: ["Receiving"],
        summary: "Retrieve a received email",
        operationId: "getReceivedEmail",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Received email detail.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivedEmail",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/receiving/{id}/attachments": {
      get: {
        tags: ["Receiving"],
        summary: "List attachments of a received email",
        operationId: "listReceivedEmailAttachments",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Attachment list.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivedEmailAttachmentList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/emails/receiving/{id}/attachments/{attachmentId}": {
      get: {
        tags: ["Receiving"],
        summary: "Retrieve an attachment from a received email",
        operationId: "getReceivedEmailAttachment",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "attachmentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Attachment detail.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivedEmailAttachmentDetail",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },

    "/api/receiving/routes": {
      get: {
        tags: ["Receiving"],
        summary: "List receiving routes",
        operationId: "listReceivingRoutes",
        security: bearerSecurity,
        parameters: [
          {
            name: "domain_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
            description: "Limit routes to one owned receiving domain.",
          },
        ],
        responses: {
          "200": {
            description: "Receiving route list.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivingRouteList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Receiving"],
        summary: "Create a receiving route",
        operationId: "createReceivingRoute",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateReceivingRouteRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created receiving route.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivingRoute",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/ValidationError" },
          ...errorResponses,
        },
      },
    },
    "/api/receiving/routes/{id}": {
      get: {
        tags: ["Receiving"],
        summary: "Retrieve a receiving route",
        operationId: "getReceivingRoute",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Receiving route detail.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivingRoute",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Receiving"],
        summary: "Update a receiving route",
        operationId: "updateReceivingRoute",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateReceivingRouteRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated receiving route.",
            content: jsonContent({
              $ref: "#/components/schemas/ReceivingRoute",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/ValidationError" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Receiving"],
        summary: "Delete a receiving route",
        operationId: "deleteReceivingRoute",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Deleted receiving route.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteReceivingRouteResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/receiving/forwarding-rules": {
      get: {
        tags: ["Receiving"],
        summary: "List inbound forwarding rules",
        operationId: "listForwardingRules",
        security: bearerSecurity,
        parameters: [
          {
            name: "domain_id",
            in: "query",
            schema: { type: "string", format: "uuid" },
            description: "Limit rules to one owned receiving domain.",
          },
        ],
        responses: {
          "200": {
            description: "Forwarding rule list.",
            content: jsonContent({
              $ref: "#/components/schemas/ForwardingRuleList",
            }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Receiving"],
        summary: "Create an inbound forwarding rule",
        operationId: "createForwardingRule",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateForwardingRuleRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created forwarding rule.",
            content: jsonContent({
              $ref: "#/components/schemas/ForwardingRule",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/ValidationError" },
          ...errorResponses,
        },
      },
    },
    "/api/receiving/forwarding-rules/{id}": {
      patch: {
        tags: ["Receiving"],
        summary: "Update an inbound forwarding rule",
        operationId: "updateForwardingRule",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateForwardingRuleRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated forwarding rule.",
            content: jsonContent({
              $ref: "#/components/schemas/ForwardingRule",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Receiving"],
        summary: "Delete an inbound forwarding rule",
        operationId: "deleteForwardingRule",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Deleted forwarding rule.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteForwardingRuleResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Domains extended ──────────────────────────────────────────
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
      patch: {
        tags: ["Domains"],
        summary: "Update a domain",
        operationId: "updateDomain",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateDomainRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated domain.",
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
    "/api/domains/{id}/deliverability": {
      get: {
        tags: ["Domains"],
        summary: "Get domain deliverability readiness",
        description:
          "Returns BIMI DNS/readiness checks and manual Apple Branded Mail status for a tenant-owned domain. This endpoint reports readiness/status only and does not provision provider resources.",
        operationId: "getDomainDeliverabilityReadiness",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Domain deliverability readiness.",
            content: jsonContent({
              $ref: "#/components/schemas/DomainDeliverabilityStatus",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Domains"],
        summary: "Update domain deliverability operator metadata",
        description:
          "Stores BIMI metadata hints and Apple Branded Mail operator notes. It does not submit provider applications or alter DNS.",
        operationId: "updateDomainDeliverabilityReadiness",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateDomainDeliverabilityRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated domain deliverability metadata.",
            content: jsonContent({
              $ref: "#/components/schemas/DomainDeliverabilityStatus",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/domains/{id}/verify": {
      post: {
        tags: ["Domains"],
        summary: "Trigger DNS verification for a domain",
        operationId: "verifyDomain",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Verification result with current DNS status.",
            content: jsonContent({ $ref: "#/components/schemas/Domain" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/domains/{id}/auto-configure": {
      post: {
        tags: ["Domains"],
        summary: "Auto-configure DNS records for a domain",
        description:
          "Pushes the required DNS records to the configured DNS provider automatically.",
        operationId: "autoConfigureDomain",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description:
              "Auto-configure result with applied DNS record actions.",
            content: jsonContent({
              $ref: "#/components/schemas/DomainAutoConfigureResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── API Keys ──────────────────────────────────────────────────
    "/api/api-keys": {
      get: {
        tags: ["API Keys"],
        summary: "List API keys",
        operationId: "listApiKeys",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated API key list.",
            content: jsonContent({ $ref: "#/components/schemas/ApiKeyList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["API Keys"],
        summary: "Create an API key",
        operationId: "createApiKey",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateApiKeyRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created API key. The token is only returned once.",
            content: jsonContent({
              $ref: "#/components/schemas/CreateApiKeyResponse",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/api-keys/{id}": {
      get: {
        tags: ["API Keys"],
        summary: "Retrieve an API key",
        operationId: "getApiKey",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "API key detail.",
            content: jsonContent({ $ref: "#/components/schemas/ApiKey" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["API Keys"],
        summary: "Update an API key",
        operationId: "updateApiKey",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateApiKeyRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated API key.",
            content: jsonContent({ $ref: "#/components/schemas/ApiKey" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["API Keys"],
        summary: "Delete an API key",
        operationId: "deleteApiKey",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "API key deleted.",
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Contacts ──────────────────────────────────────────────────
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
    "/api/contacts/{id}": {
      get: {
        tags: ["Contacts"],
        summary: "Retrieve a contact",
        operationId: "getContact",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Contact detail.",
            content: jsonContent({ $ref: "#/components/schemas/Contact" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Contacts"],
        summary: "Update a contact",
        operationId: "updateContact",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateContactRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated contact.",
            content: jsonContent({ $ref: "#/components/schemas/Contact" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Contacts"],
        summary: "Delete a contact",
        operationId: "deleteContact",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Contact deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteContactResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/contacts/{id}/segments": {
      get: {
        tags: ["Contacts"],
        summary: "List segments a contact belongs to",
        operationId: "listContactSegments",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Segment membership list.",
            content: jsonContent({
              $ref: "#/components/schemas/ContactSegmentList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/contacts/{id}/segments/{segment_id}": {
      post: {
        tags: ["Contacts"],
        summary: "Add a contact to a segment",
        operationId: "addContactToSegment",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "segment_id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Contact added to segment.",
            content: jsonContent({
              $ref: "#/components/schemas/ContactSegmentMembership",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Contacts"],
        summary: "Remove a contact from a segment",
        operationId: "removeContactFromSegment",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "segment_id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Contact removed from segment.",
            content: jsonContent({
              $ref: "#/components/schemas/ContactSegmentMembership",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/contacts/{id}/topics": {
      get: {
        tags: ["Contacts"],
        summary: "List topic subscriptions for a contact",
        operationId: "listContactTopics",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Topic subscription list.",
            content: jsonContent({
              $ref: "#/components/schemas/ContactTopicList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Contacts"],
        summary: "Update topic subscriptions for a contact",
        operationId: "updateContactTopics",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateContactTopicsRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated topic subscriptions.",
            content: jsonContent({
              $ref: "#/components/schemas/ContactTopicsUpdateResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/contacts/bulk": {
      post: {
        tags: ["Contacts"],
        summary: "Bulk contact operations",
        description:
          "Perform bulk upsert, delete, subscribe, or unsubscribe operations on contacts.",
        operationId: "bulkContactAction",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/BulkContactRequest",
          }),
        },
        responses: {
          "200": {
            description: "Bulk operation result.",
            content: jsonContent({
              $ref: "#/components/schemas/BulkContactResponse",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/contacts/import": {
      post: {
        tags: ["Contacts"],
        summary: "Import contacts from a CSV file",
        operationId: "importContacts",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "CSV file to import (max 10MB).",
                  },
                  mapping: {
                    type: "string",
                    description: "JSON-encoded column-to-field mapping object.",
                  },
                  segment_id: {
                    type: "string",
                    format: "uuid",
                    description:
                      "Optional segment to add imported contacts to.",
                  },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Import result with counts.",
            content: jsonContent({
              $ref: "#/components/schemas/ContactImportResponse",
            }),
          },
          "413": {
            description: "File exceeds 10MB limit.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          "415": {
            description: "Unsupported file type.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
    },
    // ── Segments ──────────────────────────────────────────────────
    "/api/segments": {
      get: {
        tags: ["Segments"],
        summary: "List segments",
        operationId: "listSegments",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description: "Full-text search filter.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated segment list.",
            content: jsonContent({ $ref: "#/components/schemas/SegmentList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Segments"],
        summary: "Create a segment",
        operationId: "createSegment",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateSegmentRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created segment.",
            content: jsonContent({ $ref: "#/components/schemas/Segment" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/segments/{id}": {
      get: {
        tags: ["Segments"],
        summary: "Retrieve a segment",
        operationId: "getSegment",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Segment detail.",
            content: jsonContent({ $ref: "#/components/schemas/Segment" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Segments"],
        summary: "Delete a segment",
        operationId: "deleteSegment",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Segment deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/SuccessResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/segments/{id}/contacts": {
      get: {
        tags: ["Segments"],
        summary: "List contacts in a segment",
        operationId: "listSegmentContacts",
        security: bearerSecurity,
        parameters: [idPathParameter, ...paginationParameters],
        responses: {
          "200": {
            description: "Paginated contact list for this segment.",
            content: jsonContent({ $ref: "#/components/schemas/ContactList" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Topics ────────────────────────────────────────────────────
    "/api/topics": {
      get: {
        tags: ["Topics"],
        summary: "List topics",
        operationId: "listTopics",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description: "Full-text search filter.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated topic list.",
            content: jsonContent({ $ref: "#/components/schemas/TopicList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Topics"],
        summary: "Create a topic",
        operationId: "createTopic",
        security: bearerSecurity,
        description:
          "OpenSend-compatible endpoint. `default_subscription` and `visibility` are optional and default to `opt_out` and `public` when omitted.",
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateTopicRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created topic.",
            content: jsonContent({ $ref: "#/components/schemas/Topic" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/topics/{id}": {
      get: {
        tags: ["Topics"],
        summary: "Retrieve a topic",
        operationId: "getTopic",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Topic detail.",
            content: jsonContent({ $ref: "#/components/schemas/Topic" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Topics"],
        summary: "Update a topic",
        operationId: "updateTopic",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateTopicRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated topic.",
            content: jsonContent({ $ref: "#/components/schemas/Topic" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Topics"],
        summary: "Delete a topic",
        operationId: "deleteTopic",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Topic deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/SuccessResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Contact Properties ────────────────────────────────────────
    "/api/properties": {
      get: {
        tags: ["Properties"],
        summary: "List contact properties",
        operationId: "listProperties",
        security: bearerSecurity,
        parameters: [
          { $ref: "#/components/parameters/Limit" },
          {
            name: "page",
            in: "query",
            description: "Page number for offset pagination.",
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated property list.",
            content: jsonContent({ $ref: "#/components/schemas/PropertyList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Properties"],
        summary: "Create a contact property",
        operationId: "createProperty",
        security: bearerSecurity,
        description:
          "OpenSend-compatible endpoint. If `key` is omitted, it is derived from `name`. If `type` is omitted, it defaults to `string`.",
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreatePropertyRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created property.",
            content: jsonContent({ $ref: "#/components/schemas/Property" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/properties/{id}": {
      get: {
        tags: ["Properties"],
        summary: "Retrieve a contact property",
        operationId: "getProperty",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Property detail.",
            content: jsonContent({ $ref: "#/components/schemas/Property" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Properties"],
        summary: "Update a contact property",
        operationId: "updateProperty",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdatePropertyRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated property.",
            content: jsonContent({ $ref: "#/components/schemas/Property" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Properties"],
        summary: "Delete a contact property",
        operationId: "deleteProperty",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Property deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/SuccessResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Broadcasts ────────────────────────────────────────────────
    "/api/broadcasts": {
      get: {
        tags: ["Broadcasts"],
        summary: "List broadcasts",
        operationId: "listBroadcasts",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "status",
            in: "query",
            description: "Filter by broadcast status.",
            schema: { type: "string" },
          },
          {
            name: "search",
            in: "query",
            description: "Full-text search filter.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated broadcast list.",
            content: jsonContent({
              $ref: "#/components/schemas/BroadcastList",
            }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Broadcasts"],
        summary: "Create a broadcast",
        operationId: "createBroadcast",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateBroadcastRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created broadcast.",
            content: jsonContent({ $ref: "#/components/schemas/Broadcast" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/broadcasts/{id}": {
      get: {
        tags: ["Broadcasts"],
        summary: "Retrieve a broadcast",
        operationId: "getBroadcast",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Broadcast detail.",
            content: jsonContent({
              $ref: "#/components/schemas/BroadcastDetail",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Broadcasts"],
        summary: "Update a broadcast",
        operationId: "updateBroadcast",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateBroadcastRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated broadcast detail.",
            content: jsonContent({
              $ref: "#/components/schemas/BroadcastDetail",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Broadcasts"],
        summary: "Delete a broadcast",
        operationId: "deleteBroadcast",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Broadcast deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteBroadcastResponse",
            }),
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/broadcasts/{id}/send": {
      post: {
        tags: ["Broadcasts"],
        summary: "Send or schedule a broadcast",
        operationId: "sendBroadcast",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: false,
          content: jsonContent({
            $ref: "#/components/schemas/SendBroadcastRequest",
          }),
        },
        responses: {
          "200": {
            description: "Broadcast queued or scheduled.",
            content: jsonContent({
              $ref: "#/components/schemas/BroadcastSendResponse",
            }),
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/broadcasts/{id}/metrics": {
      get: {
        tags: ["Broadcasts"],
        summary: "Retrieve delivery metrics for a broadcast",
        operationId: "getBroadcastMetrics",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Broadcast delivery metrics.",
            content: jsonContent({
              $ref: "#/components/schemas/BroadcastMetrics",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/automations": {
      get: {
        tags: ["Automations"],
        summary: "List automations",
        description:
          "Root-compatible public API route. Requires a full-access API key; dashboard session cookies do not authorize this path.",
        operationId: "listRootAutomations",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "status",
            in: "query",
            description:
              "Filter by automation status (draft, enabled, disabled).",
            schema: {
              type: "string",
              enum: ["draft", "enabled", "disabled"],
            },
          },
          {
            name: "search",
            in: "query",
            description: "Full-text search filter.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated automation list.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationList",
            }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Automations"],
        summary: "Create an automation",
        description:
          "Root-compatible public API route. Requires a full-access API key; dashboard session cookies do not authorize this path.",
        operationId: "createRootAutomation",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateAutomationRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created automation.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          ...errorResponses,
        },
      },
    },
    "/automations/{automation_id}": {
      get: {
        tags: ["Automations"],
        summary: "Retrieve an automation",
        description:
          "Root-compatible public API route. Requires a full-access API key and returns only tenant-scoped records.",
        operationId: "getRootAutomation",
        security: bearerSecurity,
        parameters: [automationIdPathParameter],
        responses: {
          "200": {
            description: "Automation detail.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Automations"],
        summary: "Update an automation",
        description:
          "Root-compatible public API route. Requires a full-access API key and preserves OpenSend automation validation semantics.",
        operationId: "updateRootAutomation",
        security: bearerSecurity,
        parameters: [automationIdPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateAutomationRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated automation.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Automations"],
        summary: "Delete an automation",
        description:
          "Deletes a disabled automation for the API-key tenant. Enabled automations must be stopped or disabled first.",
        operationId: "deleteRootAutomation",
        security: bearerSecurity,
        parameters: [automationIdPathParameter],
        responses: {
          "200": {
            description: "Automation deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteAutomationResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "Cannot delete an enabled automation.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/automations/{automation_id}/runs": {
      get: {
        tags: ["Automations"],
        summary: "List runs for an automation",
        description:
          "Root-compatible public API route. Requires a full-access API key and lists runs for a tenant-scoped automation.",
        operationId: "listRootAutomationRuns",
        security: bearerSecurity,
        parameters: [
          automationIdPathParameter,
          ...paginationParameters,
          {
            name: "status",
            in: "query",
            description:
              "Filter by run status. Multiple statuses may be comma-separated.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated automation run list.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationRunList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/automations/{automation_id}/runs/{run_id}": {
      get: {
        tags: ["Automations"],
        summary: "Retrieve an automation run",
        description:
          "Root-compatible public API route. Requires a full-access API key and returns only runs belonging to the requested tenant-scoped automation.",
        operationId: "getRootAutomationRun",
        security: bearerSecurity,
        parameters: [automationIdPathParameter, automationRunIdPathParameter],
        responses: {
          "200": {
            description: "Automation run detail.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationRun",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/automations/{automation_id}/stop": {
      post: {
        tags: ["Automations"],
        summary: "Stop an automation",
        description:
          "Idempotently sets the tenant-scoped automation status to disabled. Existing queued, waiting, or running automation runs are not cancelled by this route; use run cancellation for individual runs.",
        operationId: "stopRootAutomation",
        security: bearerSecurity,
        parameters: [automationIdPathParameter],
        responses: {
          "200": {
            description:
              "Automation stopped and returned with status disabled.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Automations ───────────────────────────────────────────────
    "/api/automations": {
      get: {
        tags: ["Automations"],
        summary: "List automations",
        operationId: "listAutomations",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "status",
            in: "query",
            description:
              "Filter by automation status (draft, enabled, disabled).",
            schema: {
              type: "string",
              enum: ["draft", "enabled", "disabled"],
            },
          },
          {
            name: "search",
            in: "query",
            description: "Full-text search filter.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated automation list.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationList",
            }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Automations"],
        summary: "Create an automation",
        operationId: "createAutomation",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateAutomationRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created automation.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/automations/{id}": {
      get: {
        tags: ["Automations"],
        summary: "Retrieve an automation",
        operationId: "getAutomation",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Automation detail.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Automations"],
        summary: "Update an automation",
        operationId: "updateAutomation",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateAutomationRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated automation.",
            content: jsonContent({ $ref: "#/components/schemas/Automation" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "Cannot delete an enabled automation.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Automations"],
        summary: "Delete an automation",
        operationId: "deleteAutomation",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Automation deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteAutomationResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "Cannot delete an enabled automation.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/automations/{id}/runs": {
      get: {
        tags: ["Automations"],
        summary: "List runs for an automation",
        operationId: "listAutomationRuns",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          ...paginationParameters,
          {
            name: "status",
            in: "query",
            description: "Filter by run status.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated automation run list.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationRunList",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/automations/{id}/runs/{runId}": {
      get: {
        tags: ["Automations"],
        summary: "Retrieve an automation run",
        operationId: "getAutomationRun",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "runId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Automation run detail.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationRun",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/automations/{id}/runs/{runId}/cancel": {
      post: {
        tags: ["Automations"],
        summary: "Cancel an in-progress automation run",
        operationId: "cancelAutomationRun",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "runId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: false,
          content: jsonContent({
            $ref: "#/components/schemas/CancelAutomationRunRequest",
          }),
        },
        responses: {
          "200": {
            description: "Run canceled.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationRun",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/automations/{id}/runs/metrics": {
      get: {
        tags: ["Automations"],
        summary: "Retrieve aggregate metrics for an automation's runs",
        operationId: "getAutomationRunMetrics",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "from",
            in: "query",
            description: "ISO 8601 start of the date range.",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            description: "ISO 8601 end of the date range.",
            schema: { type: "string", format: "date-time" },
          },
        ],
        responses: {
          "200": {
            description: "Automation run metrics.",
            content: jsonContent({
              $ref: "#/components/schemas/AutomationRunMetrics",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Dedicated IPs ─────────────────────────────────────────────
    "/api/dedicated-ips": {
      get: {
        tags: ["Dedicated IPs"],
        summary: "List dedicated IP lifecycle records",
        operationId: "listDedicatedIpPools",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "List of dedicated IP lifecycle records.",
            content: jsonContent({
              $ref: "#/components/schemas/DedicatedIpPoolList",
            }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Dedicated IPs"],
        summary: "Create a dedicated IP lifecycle request",
        description:
          "Creates a manual dedicated IP lifecycle record with status `requested`. This v1 endpoint does not provision provider IPs or start warmup flows. Requires the caller's plan to have `dedicated_ips_enabled`.",
        operationId: "createDedicatedIpPool",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateDedicatedIpPoolRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created dedicated IP pool.",
            content: jsonContent({
              $ref: "#/components/schemas/DedicatedIpPool",
            }),
          },
          "402": { $ref: "#/components/responses/QuotaExceeded" },
          "403": { $ref: "#/components/responses/Forbidden" },
          ...errorResponses,
        },
      },
    },
    "/api/dedicated-ips/{id}": {
      get: {
        tags: ["Dedicated IPs"],
        summary: "Retrieve a dedicated IP lifecycle record",
        operationId: "getDedicatedIpPool",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Dedicated IP pool detail.",
            content: jsonContent({
              $ref: "#/components/schemas/DedicatedIpPool",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Dedicated IPs"],
        summary: "Retire a dedicated IP lifecycle record",
        operationId: "deleteDedicatedIpPool",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Pool retired.",
            content: jsonContent({
              $ref: "#/components/schemas/DedicatedIpPoolDeleted",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Unsubscribe Page ──────────────────────────────────────────
    "/api/unsubscribe-page": {
      get: {
        tags: ["Unsubscribe Page"],
        summary: "Get unsubscribe page settings",
        description:
          "Returns the current user's unsubscribe confirmation page customization, or system defaults if none have been saved.",
        operationId: "getUnsubscribePageSettings",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Unsubscribe page settings.",
            content: jsonContent({
              $ref: "#/components/schemas/UnsubscribePageSettings",
            }),
          },
          ...errorResponses,
        },
      },
      put: {
        tags: ["Unsubscribe Page"],
        summary: "Update unsubscribe page settings",
        description:
          "Upserts the unsubscribe confirmation page customization for the authenticated user.",
        operationId: "updateUnsubscribePageSettings",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateUnsubscribePageSettingsRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated unsubscribe page settings.",
            content: jsonContent({
              $ref: "#/components/schemas/UnsubscribePageSettings",
            }),
          },
          ...errorResponses,
        },
      },
    },
    // ── Webhooks ──────────────────────────────────────────────────
    "/api/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "List webhooks",
        operationId: "listWebhooks",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated webhook list.",
            content: jsonContent({ $ref: "#/components/schemas/WebhookList" }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Create a webhook",
        operationId: "createWebhook",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateWebhookRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created webhook with signing secret.",
            content: jsonContent({
              $ref: "#/components/schemas/WebhookCreated",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/webhooks/{id}": {
      get: {
        tags: ["Webhooks"],
        summary: "Retrieve a webhook",
        operationId: "getWebhook",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Webhook detail including recent deliveries.",
            content: jsonContent({
              $ref: "#/components/schemas/WebhookDetail",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Webhooks"],
        summary: "Update a webhook",
        operationId: "updateWebhook",
        security: bearerSecurity,
        parameters: [idPathParameter],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateWebhookRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated webhook.",
            content: jsonContent({ $ref: "#/components/schemas/Webhook" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Webhooks"],
        summary: "Delete a webhook",
        operationId: "deleteWebhook",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Webhook deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteWebhookResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/webhooks/{id}/deliveries/{deliveryId}/replay": {
      post: {
        tags: ["Webhooks"],
        summary: "Replay a webhook delivery",
        operationId: "replayWebhookDelivery",
        security: bearerSecurity,
        parameters: [
          idPathParameter,
          {
            name: "deliveryId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "202": {
            description: "Replay accepted.",
            content: jsonContent({
              $ref: "#/components/schemas/WebhookDeliveryReplayResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "Webhook is disabled.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
    },
    // ── Suppressions ──────────────────────────────────────────────
    "/api/suppressions": {
      get: {
        tags: ["Suppressions"],
        summary: "List suppressions",
        operationId: "listSuppressions",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated suppression list.",
            content: jsonContent({
              $ref: "#/components/schemas/SuppressionList",
            }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/suppressions/{email}": {
      delete: {
        tags: ["Suppressions"],
        summary: "Remove a suppression",
        operationId: "deleteSuppression",
        security: bearerSecurity,
        parameters: [
          {
            name: "email",
            in: "path",
            required: true,
            description:
              "URL-encoded email address to remove from suppression list.",
            schema: { type: "string", format: "email" },
          },
        ],
        responses: {
          "200": {
            description: "Suppression removed.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteSuppressionResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Logs ─────────────────────────────────────────────────────
    "/api/logs": {
      get: {
        tags: ["Logs"],
        summary: "List API request logs",
        operationId: "listLogs",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          {
            name: "before",
            in: "query",
            description: "Cursor for reverse pagination.",
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            description: "Filter by HTTP response status code.",
            schema: { type: "string" },
          },
          {
            name: "method",
            in: "query",
            description: "Filter by HTTP method.",
            schema: { type: "string" },
          },
          {
            name: "api_key_id",
            in: "query",
            description: "Filter by API key ID.",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "date_from",
            in: "query",
            description: "ISO 8601 start of the date range.",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "date_to",
            in: "query",
            description: "ISO 8601 end of the date range.",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "q",
            in: "query",
            description: "Full-text search.",
            schema: { type: "string" },
          },
          {
            name: "tag_name",
            in: "query",
            description:
              "Filter logs to requests linked to emails with this tag name. Uses the same tag validation as send requests.",
            schema: {
              type: "string",
              maxLength: 256,
              pattern: "^[A-Za-z0-9_-]+$",
            },
          },
          {
            name: "tag_value",
            in: "query",
            description:
              "Optional tag value filter. Requires tag_name and may be an empty string.",
            schema: {
              type: "string",
              maxLength: 256,
              pattern: "^[A-Za-z0-9_-]*$",
            },
          },
        ],
        responses: {
          "200": {
            description: "Paginated log list.",
            content: jsonContent({ $ref: "#/components/schemas/LogList" }),
          },
          ...errorResponses,
        },
      },
    },
    "/api/logs/{id}": {
      get: {
        tags: ["Logs"],
        summary: "Retrieve a log entry",
        operationId: "getLog",
        security: bearerSecurity,
        parameters: [idPathParameter],
        responses: {
          "200": {
            description: "Log detail.",
            content: jsonContent({ $ref: "#/components/schemas/Log" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    // ── Events ────────────────────────────────────────────────────
    "/api/events": {
      get: {
        tags: ["Events"],
        summary: "List custom event definitions",
        operationId: "listEvents",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: {
          "200": {
            description: "Paginated custom event definition list.",
            content: jsonContent({
              $ref: "#/components/schemas/CustomEventList",
            }),
          },
          ...errorResponses,
        },
      },
      post: {
        tags: ["Events"],
        summary: "Create a custom event definition",
        operationId: "createEvent",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/CreateCustomEventRequest",
          }),
        },
        responses: {
          "201": {
            description: "Created custom event definition.",
            content: jsonContent({ $ref: "#/components/schemas/CustomEvent" }),
          },
          "409": {
            description: "An event with this name already exists.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Events"],
        summary: "Delete a custom event definition",
        description:
          "Pass the event definition ID as the `id` query parameter.",
        operationId: "deleteEvent",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            description: "Custom event definition ID.",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Event definition deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteCustomEventResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/events/{identifier}": {
      get: {
        tags: ["Events"],
        summary: "Retrieve a custom event definition",
        description:
          "Identifier may be the custom event definition ID or the exact event name. UUID-looking identifiers are resolved as IDs first, then by name within the authenticated tenant.",
        operationId: "getEvent",
        security: bearerSecurity,
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            description: "Custom event definition ID or exact event name.",
            schema: { type: "string", minLength: 1, maxLength: 255 },
          },
        ],
        responses: {
          "200": {
            description: "Custom event definition detail.",
            content: jsonContent({ $ref: "#/components/schemas/CustomEvent" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
      patch: {
        tags: ["Events"],
        summary: "Update a custom event definition",
        description:
          "Identifier may be the custom event definition ID or the exact event name. UUID-looking identifiers are resolved as IDs first, then by name within the authenticated tenant.",
        operationId: "updateEvent",
        security: bearerSecurity,
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            description: "Custom event definition ID or exact event name.",
            schema: { type: "string", minLength: 1, maxLength: 255 },
          },
        ],
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/UpdateCustomEventRequest",
          }),
        },
        responses: {
          "200": {
            description: "Updated custom event definition.",
            content: jsonContent({ $ref: "#/components/schemas/CustomEvent" }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "An event with this name already exists.",
            content: jsonContent({
              $ref: "#/components/schemas/ErrorEnvelope",
            }),
          },
          ...errorResponses,
        },
      },
      delete: {
        tags: ["Events"],
        summary: "Delete a custom event definition by identifier",
        description:
          "Identifier may be the custom event definition ID or the exact event name. UUID-looking identifiers are resolved as IDs first, then by name within the authenticated tenant. The legacy `DELETE /api/events?id=...` collection form remains supported for existing callers.",
        operationId: "deleteEventByIdentifier",
        security: bearerSecurity,
        parameters: [
          {
            name: "identifier",
            in: "path",
            required: true,
            description: "Custom event definition ID or exact event name.",
            schema: { type: "string", minLength: 1, maxLength: 255 },
          },
        ],
        responses: {
          "200": {
            description: "Event definition deleted.",
            content: jsonContent({
              $ref: "#/components/schemas/DeleteCustomEventResponse",
            }),
          },
          "404": { $ref: "#/components/responses/NotFound" },
          ...errorResponses,
        },
      },
    },
    "/api/events/send": {
      post: {
        tags: ["Events"],
        summary: "Send (fire) a custom event for a contact",
        operationId: "sendEvent",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: jsonContent({
            $ref: "#/components/schemas/SendCustomEventRequest",
          }),
        },
        responses: {
          "202": {
            description: "Event accepted and automations resumed.",
            content: jsonContent({
              $ref: "#/components/schemas/SendCustomEventResponse",
            }),
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
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
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
      SuccessResponse: {
        type: "object",
        properties: { success: { type: "boolean" } },
        required: ["success"],
      },
      UpdateEmailRequest: {
        type: "object",
        properties: {
          scheduled_at: {
            type: "string",
            description:
              "New ISO 8601 delivery time for a scheduled email. Same format as SendEmailRequest.scheduled_at.",
          },
        },
      },
      EmailEvent: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email_id: { type: "string", format: "uuid" },
          type: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "email_id", "type", "created_at"],
      },
      EmailEventList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailEvent" },
          },
        },
        required: ["object", "data"],
      },
      EmailTraceEvent: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["email_trace_event"] },
          id: { type: "string" },
          source: {
            type: "string",
            enum: ["request", "queue", "provider", "webhook", "suppression"],
          },
          type: { type: "string" },
          created_at: { type: "string", format: "date-time" },
          summary: { type: "string" },
          details: { type: "object", additionalProperties: true },
          related_id: { type: "string", nullable: true },
          related_url: { type: "string", nullable: true },
        },
        required: [
          "object",
          "id",
          "source",
          "type",
          "created_at",
          "summary",
          "details",
          "related_id",
          "related_url",
        ],
      },
      EmailTrace: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["email_trace"] },
          email_id: { type: "string", format: "uuid" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailTraceEvent" },
          },
        },
        required: ["object", "email_id", "data"],
      },
      EmailAttachmentDetail: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          filename: { type: "string" },
          content_type: { type: "string", nullable: true },
          size: { type: "integer" },
          url: {
            type: "string",
            format: "uri",
            description: "Pre-signed download URL.",
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "filename"],
      },
      EmailAttachmentList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/EmailAttachmentDetail" },
          },
        },
        required: ["object", "data"],
      },

      ReceivingRouteDecision: {
        type: "object",
        properties: {
          recipient: { type: "string", format: "email" },
          status: {
            type: "string",
            enum: ["exact", "alias", "catch_all", "unrouteable"],
          },
          domainId: { type: "string", format: "uuid" },
          routeId: { type: "string", format: "uuid" },
          routeType: {
            type: "string",
            enum: ["exact", "alias", "catch_all"],
          },
          localPart: { type: "string" },
          targetAddress: { type: "string", format: "email" },
        },
        required: ["recipient", "status"],
      },
      ReceivingRoute: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["receiving_route"] },
          id: { type: "string", format: "uuid" },
          domain_id: { type: "string", format: "uuid" },
          domain: { type: "string" },
          type: {
            type: "string",
            enum: ["exact", "alias", "catch_all"],
          },
          local_part: { type: "string", nullable: true },
          target_local_part: { type: "string" },
          target_address: { type: "string", format: "email" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "domain_id",
          "domain",
          "type",
          "local_part",
          "target_local_part",
          "target_address",
          "created_at",
          "updated_at",
        ],
      },
      ReceivingRouteList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ReceivingRoute" },
          },
        },
        required: ["object", "data"],
      },
      CreateReceivingRouteRequest: {
        type: "object",
        properties: {
          domain_id: { type: "string", format: "uuid" },
          type: {
            type: "string",
            enum: ["exact", "alias", "catch_all"],
          },
          local_part: { type: "string", nullable: true },
          target_local_part: { type: "string", nullable: true },
        },
        required: ["domain_id", "type"],
      },
      UpdateReceivingRouteRequest: {
        type: "object",
        properties: {
          local_part: { type: "string", nullable: true },
          target_local_part: { type: "string", nullable: true },
        },
      },
      DeleteReceivingRouteResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["receiving_route"] },
          id: { type: "string", format: "uuid" },
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
      },
      ForwardingAttempt: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["forwarding_attempt"] },
          id: { type: "string", format: "uuid" },
          rule_id: { type: "string", format: "uuid", nullable: true },
          received_email_id: { type: "string", format: "uuid" },
          forwarded_email_id: {
            type: "string",
            format: "uuid",
            nullable: true,
          },
          status: {
            type: "string",
            enum: ["queued", "skipped", "failed"],
          },
          reason: { type: "string" },
          destinations: {
            type: "array",
            items: { type: "string", format: "email" },
          },
          retry_eligible: { type: "boolean" },
          error_message: { type: "string", nullable: true },
          forwarded_email_status: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "received_email_id",
          "status",
          "reason",
          "destinations",
          "retry_eligible",
          "created_at",
        ],
      },
      ForwardingRule: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["forwarding_rule"] },
          id: { type: "string", format: "uuid" },
          domain_id: { type: "string", format: "uuid" },
          domain: { type: "string" },
          route_id: { type: "string", format: "uuid" },
          route_type: {
            type: "string",
            enum: ["exact", "alias", "catch_all"],
          },
          route_local_part: { type: "string", nullable: true },
          route_target_address: { type: "string", format: "email" },
          destinations: {
            type: "array",
            items: { type: "string", format: "email" },
          },
          status: {
            type: "string",
            enum: ["active", "disabled", "invalid"],
          },
          invalid_reason: { type: "string", nullable: true },
          last_attempt: { type: "object", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "domain_id",
          "domain",
          "route_id",
          "route_target_address",
          "destinations",
          "status",
          "created_at",
          "updated_at",
        ],
      },
      ForwardingRuleList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ForwardingRule" },
          },
        },
        required: ["object", "data"],
      },
      CreateForwardingRuleRequest: {
        type: "object",
        properties: {
          route_id: { type: "string", format: "uuid" },
          destinations: {
            type: "array",
            minItems: 1,
            maxItems: 25,
            items: { type: "string", format: "email" },
          },
          status: { type: "string", enum: ["active", "disabled"] },
        },
        required: ["route_id", "destinations"],
      },
      UpdateForwardingRuleRequest: {
        type: "object",
        properties: {
          destinations: {
            type: "array",
            minItems: 1,
            maxItems: 25,
            items: { type: "string", format: "email" },
          },
          status: { type: "string", enum: ["active", "disabled"] },
        },
      },
      DeleteForwardingRuleResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["forwarding_rule"] },
          id: { type: "string", format: "uuid" },
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
      },
      ReceivedEmailListItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          from: { type: "string" },
          to: { type: "array", items: { type: "string", format: "email" } },
          subject: { type: "string" },
          route_decisions: {
            type: "array",
            items: { $ref: "#/components/schemas/ReceivingRouteDecision" },
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "from",
          "to",
          "subject",
          "route_decisions",
          "created_at",
        ],
      },
      ReceivedEmail: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["received_email"] },
          id: { type: "string", format: "uuid" },
          from: { type: "string" },
          to: { type: "array", items: { type: "string", format: "email" } },
          subject: { type: "string" },
          html: { type: "string", nullable: true },
          text: { type: "string", nullable: true },
          route_decisions: {
            type: "array",
            items: { $ref: "#/components/schemas/ReceivingRouteDecision" },
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "from",
          "to",
          "subject",
          "route_decisions",
          "created_at",
        ],
      },
      ReceivedEmailList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ReceivedEmailListItem" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      ReceivedEmailAttachment: {
        type: "object",
        properties: {
          id: { type: "string" },
          filename: { type: "string" },
          content_type: { type: "string" },
          size: { type: "integer" },
        },
        required: ["id", "filename", "content_type", "size"],
      },
      ReceivedEmailAttachmentList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ReceivedEmailAttachment" },
          },
        },
        required: ["object", "data"],
      },
      ReceivedEmailAttachmentDetail: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["received_email_attachment"] },
          id: { type: "string" },
          filename: { type: "string" },
          content_type: { type: "string" },
          size: { type: "integer" },
          download_url: { type: "string", format: "uri" },
          expires_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "filename",
          "content_type",
          "size",
          "download_url",
          "expires_at",
        ],
      },
      UpdateDomainRequest: {
        type: "object",
        description: "At least one field is required.",
        properties: {
          click_tracking: { type: "boolean" },
          open_tracking: { type: "boolean" },
          tracking_subdomain: { type: "string", nullable: true },
          capabilities: {
            type: "array",
            items: { $ref: "#/components/schemas/DomainCapability" },
          },
          sending_enabled: { type: "boolean" },
          receiving_enabled: { type: "boolean" },
          tls: { type: "string", enum: ["opportunistic", "enforced"] },
        },
      },
      DomainAutoConfigureResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["domain"] },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          records: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          dns_records: {
            type: "array",
            description: "Actions taken on each DNS record.",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                name: { type: "string" },
                type: { type: "string" },
                reason: { type: "string", nullable: true },
              },
              required: ["action", "name", "type"],
            },
          },
        },
        required: ["object", "id", "name"],
      },
      ApiKey: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["api_key"] },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          permission: {
            type: "string",
            enum: ["full_access", "sending_access"],
          },
          domain: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          last_used_at: { type: "string", format: "date-time", nullable: true },
        },
        required: ["object", "id", "name", "permission"],
      },
      ApiKeyList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/ApiKey" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateApiKeyRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          permission: {
            type: "string",
            enum: ["full_access", "sending_access"],
          },
          domain_id: {
            type: "string",
            format: "uuid",
            description: "Restrict this key to a specific sending domain.",
          },
        },
        required: ["name"],
      },
      CreateApiKeyResponse: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          token: {
            type: "string",
            description:
              "The raw API key token. Returned only once at creation.",
          },
        },
        required: ["id", "token"],
      },
      UpdateApiKeyRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          permission: {
            type: "string",
            enum: ["full_access", "sending_access"],
          },
          domain_id: {
            type: "string",
            format: "uuid",
            nullable: true,
          },
        },
      },
      UpdateContactRequest: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          first_name: { type: "string", nullable: true },
          last_name: { type: "string", nullable: true },
          unsubscribed: { type: "boolean" },
          properties: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      },
      DeleteContactResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["contact"] },
          id: { type: "string", format: "uuid" },
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
      },
      ContactSegmentList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      ContactSegmentMembership: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["contact_segment"] },
          contact_id: { type: "string", format: "uuid" },
          segment_id: { type: "string", format: "uuid" },
          added: { type: "boolean" },
          deleted: { type: "boolean" },
        },
        required: ["object", "contact_id", "segment_id"],
      },
      ContactTopicList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                subscription: { type: "string", enum: ["opt_in", "opt_out"] },
              },
              required: ["id", "name", "subscription"],
            },
          },
        },
        required: ["object", "data"],
      },
      UpdateContactTopicsRequest: {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                subscription: { type: "string", enum: ["opt_in", "opt_out"] },
              },
              required: ["id", "subscription"],
            },
          },
        },
        required: ["topics"],
      },
      ContactTopicsUpdateResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["contact_topics"] },
          contact_id: { type: "string", format: "uuid" },
          updated: { type: "boolean" },
        },
        required: ["object", "contact_id", "updated"],
      },
      BulkContactRequest: {
        type: "object",
        description: "Bulk operation payload.",
        properties: {
          action: {
            type: "string",
            enum: ["upsert", "delete", "subscribe", "unsubscribe"],
          },
          contacts: {
            type: "array",
            items: { $ref: "#/components/schemas/CreateContactRequest" },
          },
          ids: {
            type: "array",
            items: { type: "string", format: "uuid" },
            description:
              "Contact IDs for delete/subscribe/unsubscribe actions.",
          },
          topic_id: {
            type: "string",
            format: "uuid",
            description: "Topic ID for subscribe/unsubscribe actions.",
          },
        },
        required: ["action"],
      },
      BulkContactResponse: {
        type: "object",
        properties: {
          created: { type: "integer" },
          updated: { type: "integer" },
          deleted: { type: "integer" },
          errors: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
      ContactImportResponse: {
        type: "object",
        properties: {
          created: { type: "integer" },
          updated: { type: "integer" },
          skipped: { type: "integer" },
          errors: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
      Segment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          type: { type: "string", nullable: true },
          contact_count: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "name"],
      },
      SegmentList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Segment" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateSegmentRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", nullable: true },
          filters: {
            type: "object",
            description: "Optional filter definition for dynamic segments.",
            additionalProperties: true,
          },
        },
        required: ["name"],
      },
      Topic: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "name"],
      },
      TopicList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Topic" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateTopicRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          default_subscription: {
            type: "string",
            enum: ["opt_in", "opt_out"],
          },
          visibility: {
            type: "string",
            enum: ["public", "private"],
          },
        },
        required: ["name"],
      },
      CreateTopicRequestStrict: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          default_subscription: {
            type: "string",
            enum: ["opt_in", "opt_out"],
          },
          visibility: {
            type: "string",
            enum: ["public", "private"],
          },
        },
        required: ["name", "default_subscription", "visibility"],
      },
      UpdateTopicRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", nullable: true },
        },
      },
      UpdateTopicRequestStrict: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", nullable: true },
          default_subscription: {
            type: "string",
            enum: ["opt_in", "opt_out"],
          },
          defaultSubscription: {
            type: "string",
            enum: ["opt_in", "opt_out"],
          },
          visibility: {
            type: "string",
            enum: ["public", "private"],
          },
        },
      },
      Property: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          key: { type: "string" },
          type: {
            type: "string",
            enum: ["string", "number", "boolean", "date"],
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "name", "key", "type"],
      },
      PropertyList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Property" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreatePropertyRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          key: { type: "string" },
          type: {
            type: "string",
            enum: ["string", "number", "boolean", "date"],
          },
          fallback_value: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
        },
        required: ["name"],
      },
      CreatePropertyRequestStrict: {
        type: "object",
        properties: {
          name: { type: "string" },
          key: { type: "string" },
          type: {
            type: "string",
            enum: ["string", "number", "boolean", "date"],
          },
          fallback_value: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
        },
        required: ["name", "key", "type"],
      },
      UpdatePropertyRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
      UpdatePropertyRequestStrict: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["string", "number", "boolean", "date"],
          },
          fallback_value: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
        },
      },
      Broadcast: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["broadcast"] },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          status: { type: "string" },
          audience_id: { type: "string", format: "uuid", nullable: true },
          topic_id: { type: "string", format: "uuid", nullable: true },
          scheduled_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["object", "id", "name", "status"],
      },
      BroadcastDetail: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["broadcast"] },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          status: { type: "string" },
          from: { type: "string", nullable: true },
          subject: { type: "string", nullable: true },
          html: { type: "string", nullable: true },
          text: { type: "string", nullable: true },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          preview_text: { type: "string", nullable: true },
          audience_id: { type: "string", format: "uuid", nullable: true },
          topic_id: { type: "string", format: "uuid", nullable: true },
          scheduled_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["object", "id", "name", "status"],
      },
      BroadcastList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Broadcast" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateBroadcastRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          from: { type: "string", format: "email" },
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          preview_text: { type: "string" },
          audience_id: { type: "string", format: "uuid" },
          topic_id: { type: "string", format: "uuid" },
        },
        required: ["name"],
      },
      UpdateBroadcastRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          from: { type: "string", format: "email" },
          subject: { type: "string" },
          html: { type: "string" },
          text: { type: "string" },
          reply_to: { $ref: "#/components/schemas/EmailRecipient" },
          preview_text: { type: "string" },
          audience_id: { type: "string", format: "uuid" },
          topic_id: { type: "string", format: "uuid" },
          scheduled_at: { type: "string" },
        },
      },
      SendBroadcastRequest: {
        type: "object",
        properties: {
          scheduled_at: {
            type: "string",
            description: "ISO 8601 date-time to schedule the broadcast.",
          },
        },
      },
      BroadcastSendResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["broadcast"] },
          id: { type: "string", format: "uuid" },
          status: { type: "string" },
          scheduled_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
        required: ["object", "id", "status"],
      },
      DeleteBroadcastResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["broadcast"] },
          id: { type: "string", format: "uuid" },
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
      },
      BroadcastMetrics: {
        type: "object",
        properties: {
          sent: { type: "integer" },
          delivered: { type: "integer" },
          opened: { type: "integer" },
          clicked: { type: "integer" },
          bounced: { type: "integer" },
          complained: { type: "integer" },
          unsubscribed: { type: "integer" },
        },
      },
      AutomationStep: {
        type: "object",
        properties: {
          key: { type: "string" },
          type: {
            type: "string",
            enum: [
              "trigger",
              "delay",
              "send_email",
              "end",
              "condition",
              "wait_for_event",
              "contact_update",
              "contact_delete",
              "add_to_segment",
            ],
          },
          config: { type: "object", additionalProperties: true },
          position: { type: "integer" },
        },
        required: ["key", "type"],
      },
      AutomationConnection: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: {
            type: "string",
            enum: ["default", "condition_met", "condition_not_met"],
          },
        },
        required: ["from", "to"],
      },
      Automation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: ["draft", "enabled", "disabled"],
          },
          trigger_event_name: { type: "string", nullable: true },
          steps: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationStep" },
          },
          connections: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationConnection" },
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "status"],
      },
      AutomationList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Automation" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateAutomationRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: {
            type: "string",
            enum: ["draft", "enabled", "disabled"],
          },
          trigger_event_name: { type: "string" },
          steps: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/AutomationStep" },
          },
          connections: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationConnection" },
          },
        },
        required: ["steps"],
      },
      UpdateAutomationRequest: {
        type: "object",
        description: "At least one field is required.",
        properties: {
          name: { type: "string" },
          status: {
            type: "string",
            enum: ["draft", "enabled", "disabled"],
          },
          trigger_event_name: { type: "string" },
          steps: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/AutomationStep" },
          },
          connections: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationConnection" },
          },
        },
      },
      DeleteAutomationResponse: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          deleted: { type: "boolean" },
        },
        required: ["id", "deleted"],
      },
      AutomationRun: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          automation_id: { type: "string", format: "uuid" },
          contact_id: { type: "string", format: "uuid", nullable: true },
          status: { type: "string" },
          current_step_key: { type: "string", nullable: true },
          started_at: { type: "string", format: "date-time", nullable: true },
          finished_at: { type: "string", format: "date-time", nullable: true },
          canceled_at: { type: "string", format: "date-time", nullable: true },
          cancel_reason: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "automation_id", "status"],
      },
      AutomationRunList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationRun" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CancelAutomationRunRequest: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            maxLength: 500,
            description: "Optional reason for cancellation.",
          },
        },
      },
      AutomationRunMetrics: {
        type: "object",
        properties: {
          total: { type: "integer" },
          completed: { type: "integer" },
          canceled: { type: "integer" },
          failed: { type: "integer" },
          running: { type: "integer" },
        },
      },
      WebhookEventType: {
        type: "string",
        enum: [
          "email.sent",
          "email.delivered",
          "email.bounced",
          "email.complained",
          "email.delivery_delayed",
          "email.scheduled",
          "email.delayed",
          "email.suppressed",
          "email.opened",
          "email.clicked",
          "email.failed",
          "contact.created",
          "contact.updated",
          "contact.deleted",
          "domain.created",
          "domain.updated",
          "domain.deleted",
        ],
      },
      WebhookDelivery: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          status: { type: "string" },
          attempt: { type: "integer" },
          status_code: { type: "integer", nullable: true },
          response_body: { type: "string", nullable: true },
          attempted_at: { type: "string", format: "date-time", nullable: true },
          next_retry_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "status", "attempt"],
      },
      Webhook: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["webhook"] },
          id: { type: "string", format: "uuid" },
          endpoint: { type: "string", format: "uri" },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
          status: { type: "string", enum: ["active", "disabled"] },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["object", "id", "endpoint", "events", "status"],
      },
      WebhookCreated: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["webhook"] },
          id: { type: "string", format: "uuid" },
          endpoint: { type: "string", format: "uri" },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
          status: { type: "string", enum: ["active", "disabled"] },
          signing_secret: {
            type: "string",
            description: "HMAC signing secret. Returned only once at creation.",
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "endpoint",
          "events",
          "status",
          "signing_secret",
        ],
      },
      WebhookDetail: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["webhook"] },
          id: { type: "string", format: "uuid" },
          endpoint: { type: "string", format: "uri" },
          events: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
          status: { type: "string", enum: ["active", "disabled"] },
          created_at: { type: "string", format: "date-time" },
          recent_deliveries: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookDelivery" },
          },
        },
        required: ["object", "id", "endpoint", "events", "status"],
      },
      WebhookList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Webhook" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateWebhookRequest: {
        type: "object",
        description: "Provide endpoint (or url) and events (or event_types).",
        properties: {
          endpoint: { type: "string", format: "uri", maxLength: 2048 },
          url: {
            type: "string",
            format: "uri",
            maxLength: 2048,
            description: "Alias for endpoint.",
          },
          events: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
          event_types: {
            type: "array",
            minItems: 1,
            description: "Alias for events.",
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
        },
      },
      UpdateWebhookRequest: {
        type: "object",
        properties: {
          endpoint: { type: "string", format: "uri", maxLength: 2048 },
          url: { type: "string", format: "uri", maxLength: 2048 },
          events: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
          event_types: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/WebhookEventType" },
          },
          status: { type: "string", enum: ["enabled", "disabled"] },
          active: { type: "boolean" },
        },
      },
      DeleteWebhookResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["webhook"] },
          id: { type: "string", format: "uuid" },
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
      },
      WebhookDeliveryReplayResponse: {
        type: "object",
        properties: {
          object: {
            type: "string",
            enum: ["webhook_delivery_replay"],
          },
          original_delivery: { $ref: "#/components/schemas/WebhookDelivery" },
          replay_delivery: { $ref: "#/components/schemas/WebhookDelivery" },
        },
        required: ["object", "original_delivery", "replay_delivery"],
      },
      Suppression: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          reason: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["email", "reason"],
      },
      SuppressionList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Suppression" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      DeleteSuppressionResponse: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          deleted: { type: "boolean" },
        },
        required: ["email", "deleted"],
      },
      Log: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          method: { type: "string" },
          path: { type: "string" },
          status: { type: "integer" },
          duration_ms: { type: "integer", nullable: true },
          api_key_id: { type: "string", format: "uuid", nullable: true },
          user_agent: { type: "string", nullable: true },
          request_body: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
          response_body: {
            type: "object",
            additionalProperties: true,
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
        },
        required: ["id", "method", "path", "status"],
      },
      LogList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Log" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CustomEvent: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["event"] },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          schema: {
            type: "object",
            additionalProperties: true,
            nullable: true,
            description: "JSON Schema definition for event payload validation.",
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "name",
          "schema",
          "created_at",
          "updated_at",
        ],
      },
      CustomEventList: {
        type: "object",
        properties: {
          object: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/CustomEvent" },
          },
          has_more: { type: "boolean" },
        },
        required: ["object", "data", "has_more"],
      },
      CreateCustomEventRequest: {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 255,
          },
          schema: {
            type: "object",
            additionalProperties: true,
            description:
              "Optional JSON Schema definition for payload validation.",
          },
        },
        required: ["name"],
      },
      UpdateCustomEventRequest: {
        type: "object",
        description: "Provide at least one field to update.",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 255,
          },
          schema: {
            type: "object",
            additionalProperties: true,
            nullable: true,
            description:
              "Optional JSON Schema definition for payload validation. Pass null to clear it.",
          },
        },
      },
      DeleteCustomEventResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["event"] },
          id: { type: "string", format: "uuid" },
          deleted: { type: "boolean" },
        },
        required: ["object", "id", "deleted"],
      },
      SendCustomEventRequest: {
        type: "object",
        description:
          "Provide either contact_id or email as the contact identifier.",
        properties: {
          event: {
            type: "string",
            minLength: 1,
            maxLength: 255,
            description: "Name of the custom event to fire.",
          },
          contact_id: {
            type: "string",
            format: "uuid",
            description: "Contact ID to fire the event for.",
          },
          email: {
            type: "string",
            format: "email",
            description: "Contact email to fire the event for.",
          },
          payload: {
            type: "object",
            additionalProperties: true,
            description:
              "Optional event payload validated against the event schema.",
          },
        },
        required: ["event"],
      },
      SendCustomEventResponse: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["event_delivery"] },
          delivery: { $ref: "#/components/schemas/CustomEventDelivery" },
          resumed_runs: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationRun" },
          },
          automation_runs: {
            type: "array",
            items: { $ref: "#/components/schemas/AutomationRun" },
          },
        },
        required: ["object", "delivery", "resumed_runs", "automation_runs"],
      },
      CustomEventDelivery: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["event_delivery"] },
          id: { type: "string", format: "uuid" },
          event: { type: "string" },
          contact_id: { type: "string", format: "uuid", nullable: true },
          email: { type: "string", format: "email", nullable: true },
          payload: {
            type: "object",
            additionalProperties: true,
          },
          received_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "event",
          "contact_id",
          "email",
          "payload",
          "received_at",
        ],
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
      // ── Unsubscribe Page ──────────────────────────────────────────
      UnsubscribePageSettings: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["unsubscribe_page_settings"] },
          logo_url: { type: "string", nullable: true, maxLength: 2048 },
          brand_color: {
            type: "string",
            pattern: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",
            description: "Hex brand color (#rrggbb or #rrggbbaa).",
          },
          headline: { type: "string", maxLength: 200 },
          message: { type: "string", maxLength: 1000 },
          footer_text: { type: "string", maxLength: 200 },
        },
        required: [
          "object",
          "logo_url",
          "brand_color",
          "headline",
          "message",
          "footer_text",
        ],
      },
      UpdateUnsubscribePageSettingsRequest: {
        type: "object",
        properties: {
          logo_url: {
            type: "string",
            nullable: true,
            maxLength: 2048,
            description:
              "Full http/https URL for the logo image. Pass null to clear.",
          },
          brand_color: {
            type: "string",
            pattern: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$",
            description: "Hex brand color applied to the page accent.",
          },
          headline: {
            type: "string",
            maxLength: 200,
            description: "Main heading on the success confirmation page.",
          },
          message: {
            type: "string",
            maxLength: 1000,
            description: "Body text on the success confirmation page.",
          },
          footer_text: {
            type: "string",
            maxLength: 200,
            description:
              "Footer attribution text shown on both success and error pages.",
          },
        },
      },
      // ── Domain deliverability readiness ─────────────────────────
      DomainDeliverabilityStatus: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["domain_deliverability_status"] },
          id: { type: "string", format: "uuid" },
          domain_id: { type: "string", format: "uuid" },
          bimi: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: [
                  "not_configured",
                  "action_required",
                  "manual_review",
                  "ready",
                ],
              },
              selector: { type: "string" },
              record_name: { type: "string" },
              logo_url: { type: "string", nullable: true },
              certificate_url: { type: "string", nullable: true },
              notes: { type: "string", nullable: true },
              checks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["pass", "warning", "fail", "info"],
                    },
                    message: { type: "string" },
                  },
                  required: ["key", "label", "status", "message"],
                },
              },
            },
            required: ["status", "selector", "record_name", "checks"],
          },
          apple_branded_mail: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: [
                  "not_started",
                  "requested",
                  "approved",
                  "rejected",
                  "manual_review",
                ],
              },
              notes: { type: "string", nullable: true },
              mode: { type: "string", enum: ["operator_notes_only"] },
            },
            required: ["status", "mode"],
          },
          last_checked_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "domain_id",
          "bimi",
          "apple_branded_mail",
          "created_at",
          "updated_at",
        ],
      },
      UpdateDomainDeliverabilityRequest: {
        type: "object",
        properties: {
          bimi_selector: { type: "string", maxLength: 63 },
          bimi_logo_url: { type: "string", nullable: true },
          bimi_certificate_url: { type: "string", nullable: true },
          bimi_notes: { type: "string", nullable: true, maxLength: 4000 },
          apple_branded_mail_status: {
            type: "string",
            enum: [
              "not_started",
              "requested",
              "approved",
              "rejected",
              "manual_review",
            ],
          },
          apple_branded_mail_notes: {
            type: "string",
            nullable: true,
            maxLength: 4000,
          },
        },
      },
      // ── Dedicated IPs ─────────────────────────────────────────────
      DedicatedIpPool: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["dedicated_ip_pool"] },
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          provider: { type: "string", enum: ["manual"] },
          provider_pool_name: { type: "string", nullable: true },
          ses_pool_name: { type: "string" },
          scaling_mode: { type: "string", enum: ["STANDARD", "MANAGED"] },
          status: {
            type: "string",
            enum: [
              "requested",
              "provisioned",
              "warming",
              "active",
              "suspended",
              "retired",
            ],
          },
          operator_notes: { type: "string", nullable: true },
          provisioned_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          warming_started_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          retired_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "object",
          "id",
          "name",
          "provider",
          "ses_pool_name",
          "scaling_mode",
          "status",
          "created_at",
          "updated_at",
        ],
      },
      DedicatedIpPoolList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/DedicatedIpPool" },
          },
        },
        required: ["object", "data"],
      },
      CreateDedicatedIpPoolRequest: {
        type: "object",
        properties: {
          name: {
            type: "string",
            minLength: 1,
            maxLength: 255,
            description: "User-facing label for the pool.",
          },
          provider_pool_name: {
            type: "string",
            minLength: 1,
            maxLength: 255,
            description:
              "Optional operator/provider reference. No provider provisioning is triggered.",
          },
          ses_pool_name: {
            type: "string",
            minLength: 1,
            maxLength: 255,
            description: "Deprecated alias for provider_pool_name.",
          },
          scaling_mode: {
            type: "string",
            enum: ["STANDARD", "MANAGED"],
            description: "SES scaling mode. Defaults to MANAGED.",
          },
        },
        required: ["name"],
      },
      DedicatedIpPoolDeleted: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["dedicated_ip_pool"] },
          id: { type: "string", format: "uuid" },
          retired: { type: "boolean" },
          status: { type: "string", enum: ["retired"] },
        },
        required: ["object", "id", "retired", "status"],
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
      Forbidden: {
        description: "Caller's plan does not include this feature.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      QuotaExceeded: {
        description: "Plan quota for this resource has been reached.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
      InternalServerError: {
        description: "Unexpected server error.",
        content: jsonContent({ $ref: "#/components/schemas/ErrorEnvelope" }),
      },
    },
  },
} as const satisfies OpenApiDocument;

const compatibilityAliases: Record<string, string> = {
  "/segments": "/api/segments",
  "/segments/{id}": "/api/segments/{id}",
  "/segments/{id}/contacts": "/api/segments/{id}/contacts",
  "/broadcasts": "/api/broadcasts",
  "/broadcasts/{id}": "/api/broadcasts/{id}",
  "/broadcasts/{id}/send": "/api/broadcasts/{id}/send",
  "/domains": "/api/domains",
  "/domains/{id}": "/api/domains/{id}",
  "/domains/{id}/verify": "/api/domains/{id}/verify",
  "/webhooks": "/api/webhooks",
  "/webhooks/{id}": "/api/webhooks/{id}",
  "/topics": "/api/topics",
  "/topics/{id}": "/api/topics/{id}",
  "/contact-properties": "/api/properties",
  "/contact-properties/{id}": "/api/properties/{id}",
  "/logs": "/api/logs",
  "/logs/{id}": "/api/logs/{id}",
  "/emails/{id}": "/api/emails/{id}",
  "/emails/{id}/events": "/api/emails/{id}/events",
  "/emails/{id}/trace": "/api/emails/{id}/trace",
  "/emails/{id}/attachments": "/api/emails/{id}/attachments",
  "/emails/{id}/attachments/{attachmentId}":
    "/api/emails/{id}/attachments/{attachmentId}",
  "/emails/receiving": "/api/emails/receiving",
  "/emails/receiving/{id}": "/api/emails/receiving/{id}",
  "/emails/receiving/{id}/attachments":
    "/api/emails/receiving/{id}/attachments",
  "/emails/receiving/{id}/attachments/{attachmentId}":
    "/api/emails/receiving/{id}/attachments/{attachmentId}",
};

const mutablePaths = openApiDocument.paths as Record<string, PathItemObject>;
for (const [aliasPath, canonicalPath] of Object.entries(compatibilityAliases)) {
  const canonicalPathItem = mutablePaths[canonicalPath];
  if (canonicalPathItem) mutablePaths[aliasPath] = canonicalPathItem;
}

function withAliasDetails(
  operation: OperationObject,
  overrides: Partial<OperationObject>,
): OperationObject {
  return { ...operation, ...overrides };
}

const canonicalEventsPath = mutablePaths["/api/events"];
if (canonicalEventsPath?.get && canonicalEventsPath.post) {
  mutablePaths["/events"] = {
    get: withAliasDetails(canonicalEventsPath.get, {
      summary: "List custom event definitions",
      description:
        "Root-compatible custom events collection route. Requires an OpenSend API key and returns event definitions scoped to the authenticated tenant.",
      operationId: "listEventsRoot",
    }),
    post: withAliasDetails(canonicalEventsPath.post, {
      summary: "Create a custom event definition",
      description:
        "Root-compatible custom events create route. Requires an OpenSend API key and creates the event definition for the authenticated tenant.",
      operationId: "createEventRoot",
    }),
  };
}

const canonicalTopicsPath = mutablePaths["/api/topics"];
if (canonicalTopicsPath?.post) {
  mutablePaths["/topics"] = {
    ...(mutablePaths["/topics"] as PathItemObject),
    post: withAliasDetails(canonicalTopicsPath.post, {
      summary: "Create a topic",
      description:
        "Root-compatible topics create route with strict schema requirements. `default_subscription` and `visibility` are required and must be explicit values. Existing `/api/topics` defaults are preserved for non-root callers.",
      requestBody: {
        required: true,
        content: jsonContent({
          $ref: "#/components/schemas/CreateTopicRequestStrict",
        }),
      },
      operationId: "createTopicRoot",
    }),
  };
}

const canonicalTopicDetailPath = mutablePaths["/api/topics/{id}"];
if (canonicalTopicDetailPath?.patch) {
  mutablePaths["/topics/{id}"] = {
    ...(mutablePaths["/topics/{id}"] as PathItemObject),
    patch: withAliasDetails(canonicalTopicDetailPath.patch, {
      summary: "Update a topic",
      description:
        "Root-compatible topic detail route. `default_subscription` (or `defaultSubscription`) and `visibility` can be supplied and must be one of the documented enum values. Both fields are optional for partial updates.",
      requestBody: {
        required: true,
        content: jsonContent({
          $ref: "#/components/schemas/UpdateTopicRequestStrict",
        }),
      },
      operationId: "updateTopicRoot",
    }),
  };
}

const canonicalContactPropertiesPath = mutablePaths["/api/properties"];
if (canonicalContactPropertiesPath?.post) {
  mutablePaths["/contact-properties"] = {
    ...(mutablePaths["/contact-properties"] as PathItemObject),
    post: withAliasDetails(canonicalContactPropertiesPath.post, {
      summary: "Create a contact property",
      description:
        "Root-compatible contact-property create route with strict schema requirements. `key` and `type` are required for root requests; OpenSend `/api/properties` defaults remain unchanged.",
      requestBody: {
        required: true,
        content: jsonContent({
          $ref: "#/components/schemas/CreatePropertyRequestStrict",
        }),
      },
      operationId: "createContactPropertyRoot",
    }),
  };
}

const canonicalContactPropertyDetailPath = mutablePaths["/api/properties/{id}"];
if (canonicalContactPropertyDetailPath?.patch) {
  mutablePaths["/contact-properties/{id}"] = {
    ...(mutablePaths["/contact-properties/{id}"] as PathItemObject),
    patch: withAliasDetails(canonicalContactPropertyDetailPath.patch, {
      summary: "Update a contact property",
      description:
        "Root-compatible contact-property detail route. If provided, `type` must be one of the documented enum values. `key` remains create-only/stable and is not patchable for compatibility with OpenSend clients.",
      requestBody: {
        required: true,
        content: jsonContent({
          $ref: "#/components/schemas/UpdatePropertyRequestStrict",
        }),
      },
      operationId: "updateContactPropertyRoot",
    }),
  };
}

const canonicalEventDetailPath = mutablePaths["/api/events/{identifier}"];
if (
  canonicalEventDetailPath?.get &&
  canonicalEventDetailPath.patch &&
  canonicalEventDetailPath.delete
) {
  mutablePaths["/events/{identifier}"] = {
    get: withAliasDetails(canonicalEventDetailPath.get, {
      summary: "Retrieve a custom event definition",
      description:
        "Root-compatible custom event detail route. The path identifier may be the event definition ID or exact event name, resolved within the authenticated tenant.",
      operationId: "getEventRoot",
    }),
    patch: withAliasDetails(canonicalEventDetailPath.patch, {
      summary: "Update a custom event definition",
      description:
        "Root-compatible custom event update route. The path identifier may be the event definition ID or exact event name, resolved within the authenticated tenant.",
      operationId: "updateEventRoot",
    }),
    delete: withAliasDetails(canonicalEventDetailPath.delete, {
      summary: "Delete a custom event definition",
      description:
        "Root-compatible custom event delete route. The path identifier may be the event definition ID or exact event name, resolved within the authenticated tenant. Existing DELETE /api/events?id=... callers remain supported.",
      operationId: "deleteEventRoot",
    }),
  };
}

const canonicalEventSendPath = mutablePaths["/api/events/send"];
if (canonicalEventSendPath?.post) {
  mutablePaths["/events/send"] = {
    post: withAliasDetails(canonicalEventSendPath.post, {
      summary: "Send (fire) a custom event for a contact",
      description:
        "Root-compatible custom event delivery route. The request body uses payload for automation variables and schema validation; properties is not accepted.",
      operationId: "sendEventRoot",
    }),
  };
}

const canonicalApiKeysPath = mutablePaths["/api/api-keys"];
if (canonicalApiKeysPath?.get && canonicalApiKeysPath.post) {
  mutablePaths["/api-keys"] = {
    get: withAliasDetails(canonicalApiKeysPath.get, {
      summary: "List API keys",
      description:
        "Root-compatible API-key collection alias. Browser dashboard GET /api-keys remains a signed-in dashboard page; API-like requests are rewritten to /api/api-keys by OpenSend middleware.",
      operationId: "listApiKeysAlias",
    }),
    post: withAliasDetails(canonicalApiKeysPath.post, {
      summary: "Create an API key",
      description:
        "Root-compatible API-key collection alias rewritten to POST /api/api-keys by OpenSend middleware.",
      operationId: "createApiKeyAlias",
    }),
  };
}

const canonicalApiKeyDetailPath = mutablePaths["/api/api-keys/{id}"];
if (canonicalApiKeyDetailPath?.delete) {
  mutablePaths["/api-keys/{id}"] = {
    delete: withAliasDetails(canonicalApiKeyDetailPath.delete, {
      summary: "Delete an API key",
      description:
        "Root-compatible API-key delete alias rewritten to DELETE /api/api-keys/{id} by OpenSend middleware. Root GET/PATCH detail aliases are not implemented.",
      operationId: "deleteApiKeyAlias",
      parameters: [apiKeyIdPathParameter],
    }),
  };
}

const canonicalContactsPath = mutablePaths["/api/contacts"];
if (canonicalContactsPath?.get && canonicalContactsPath.post) {
  mutablePaths["/contacts"] = {
    get: withAliasDetails(canonicalContactsPath.get, {
      summary: "List contacts",
      description:
        "Root-compatible contacts collection route implemented by src/app/contacts/route.ts.",
      operationId: "listContactsAlias",
    }),
    post: withAliasDetails(canonicalContactsPath.post, {
      summary: "Create a contact",
      description:
        "Root-compatible contacts collection route implemented by src/app/contacts/route.ts.",
      operationId: "createContactAlias",
    }),
  };
}

const canonicalContactDetailPath = mutablePaths["/api/contacts/{id}"];
if (
  canonicalContactDetailPath?.get &&
  canonicalContactDetailPath.patch &&
  canonicalContactDetailPath.delete
) {
  mutablePaths["/contacts/{contact_id}"] = {
    get: withAliasDetails(canonicalContactDetailPath.get, {
      summary: "Retrieve a contact",
      description:
        "Root-compatible contact detail route implemented by src/app/contacts/[contact_id]/route.ts.",
      operationId: "getContactAlias",
      parameters: [contactIdPathParameter],
    }),
    patch: withAliasDetails(canonicalContactDetailPath.patch, {
      summary: "Update a contact",
      description:
        "Root-compatible contact detail route implemented by src/app/contacts/[contact_id]/route.ts.",
      operationId: "updateContactAlias",
      parameters: [contactIdPathParameter],
    }),
    delete: withAliasDetails(canonicalContactDetailPath.delete, {
      summary: "Delete a contact",
      description:
        "Root-compatible contact detail route implemented by src/app/contacts/[contact_id]/route.ts.",
      operationId: "deleteContactAlias",
      parameters: [contactIdPathParameter],
    }),
  };
}

const canonicalContactSegmentsPath =
  mutablePaths["/api/contacts/{id}/segments"];
if (canonicalContactSegmentsPath?.get) {
  mutablePaths["/contacts/{contact_id}/segments"] = {
    get: withAliasDetails(canonicalContactSegmentsPath.get, {
      summary: "List segments a contact belongs to",
      description:
        "Root-compatible contact segment relationship route implemented by src/app/contacts/[contact_id]/segments/route.ts.",
      operationId: "listContactSegmentsAlias",
      parameters: [contactIdPathParameter],
    }),
  };
}

const canonicalContactSegmentMutationPath =
  mutablePaths["/api/contacts/{id}/segments/{segment_id}"];
if (
  canonicalContactSegmentMutationPath?.post &&
  canonicalContactSegmentMutationPath.delete
) {
  mutablePaths["/contacts/{contact_id}/segments/{segment_id}"] = {
    post: withAliasDetails(canonicalContactSegmentMutationPath.post, {
      summary: "Add a contact to a segment",
      description:
        "Root-compatible contact segment relationship route implemented by src/app/contacts/[contact_id]/segments/[segment_id]/route.ts.",
      operationId: "addContactToSegmentAlias",
      parameters: [contactIdPathParameter, contactSegmentIdPathParameter],
    }),
    delete: withAliasDetails(canonicalContactSegmentMutationPath.delete, {
      summary: "Remove a contact from a segment",
      description:
        "Root-compatible contact segment relationship route implemented by src/app/contacts/[contact_id]/segments/[segment_id]/route.ts.",
      operationId: "removeContactFromSegmentAlias",
      parameters: [contactIdPathParameter, contactSegmentIdPathParameter],
    }),
  };
}

const canonicalContactTopicsPath = mutablePaths["/api/contacts/{id}/topics"];
if (canonicalContactTopicsPath?.get && canonicalContactTopicsPath.patch) {
  mutablePaths["/contacts/{contact_id}/topics"] = {
    get: withAliasDetails(canonicalContactTopicsPath.get, {
      summary: "List topic subscriptions for a contact",
      description:
        "Root-compatible contact topic relationship route implemented by src/app/contacts/[contact_id]/topics/route.ts.",
      operationId: "listContactTopicsAlias",
      parameters: [contactIdPathParameter],
    }),
    patch: withAliasDetails(canonicalContactTopicsPath.patch, {
      summary: "Update topic subscriptions for a contact",
      description:
        "Root-compatible contact topic relationship route implemented by src/app/contacts/[contact_id]/topics/route.ts.",
      operationId: "updateContactTopicsAlias",
      parameters: [contactIdPathParameter],
    }),
  };
}

const audienceSchema = {
  type: "object",
  properties: {
    object: { type: "string" },
    id: { type: "string" },
    name: { type: "string" },
    created_at: { type: "string", format: "date-time" },
  },
  required: ["object", "id", "name"],
} satisfies JsonSchema;

const audienceListSchema = {
  type: "object",
  properties: {
    object: { type: "string" },
    data: {
      type: "array",
      items: audienceSchema,
    },
    has_more: { type: "boolean" },
  },
  required: ["object", "data", "has_more"],
} satisfies JsonSchema;

const deleteAudienceResponseSchema = {
  type: "object",
  properties: {
    object: { type: "string" },
    id: { type: "string" },
    deleted: { type: "boolean" },
  },
  required: ["object", "id", "deleted"],
} satisfies JsonSchema;

mutablePaths["/audiences"] = {
  get: {
    tags: ["Segments"],
    summary: "List audiences",
    description:
      "Resend-compatible audience alias implemented by src/app/audiences/route.ts using OpenSend segment storage.",
    operationId: "listAudiencesAlias",
    security: bearerSecurity,
    parameters: [
      ...paginationParameters,
      {
        name: "search",
        in: "query",
        description: "Full-text search filter.",
        schema: { type: "string" },
      },
    ],
    responses: {
      "200": {
        description: "Audience list.",
        content: jsonContent(audienceListSchema),
      },
      ...errorResponses,
    },
  },
  post: {
    tags: ["Segments"],
    summary: "Create an audience",
    description:
      "Resend-compatible audience alias implemented by src/app/audiences/route.ts using OpenSend segment storage.",
    operationId: "createAudienceAlias",
    security: bearerSecurity,
    requestBody: {
      required: true,
      content: jsonContent({
        $ref: "#/components/schemas/CreateSegmentRequest",
      }),
    },
    responses: {
      "201": {
        description: "Created audience.",
        content: jsonContent(audienceSchema),
      },
      ...errorResponses,
    },
  },
};

mutablePaths["/audiences/{audience_id}"] = {
  get: {
    tags: ["Segments"],
    summary: "Retrieve an audience",
    description:
      "Resend-compatible audience detail alias implemented by src/app/audiences/[audience_id]/route.ts using OpenSend segment storage.",
    operationId: "getAudienceAlias",
    security: bearerSecurity,
    parameters: [audienceIdPathParameter],
    responses: {
      "200": {
        description: "Audience detail.",
        content: jsonContent(audienceSchema),
      },
      "404": { $ref: "#/components/responses/NotFound" },
      ...errorResponses,
    },
  },
  delete: {
    tags: ["Segments"],
    summary: "Delete an audience",
    description:
      "Resend-compatible audience detail alias implemented by src/app/audiences/[audience_id]/route.ts using OpenSend segment storage.",
    operationId: "deleteAudienceAlias",
    security: bearerSecurity,
    parameters: [audienceIdPathParameter],
    responses: {
      "200": {
        description: "Audience deleted.",
        content: jsonContent(deleteAudienceResponseSchema),
      },
      "404": { $ref: "#/components/responses/NotFound" },
      ...errorResponses,
    },
  },
};

const canonicalEmailsPath = mutablePaths["/api/emails"];
const existingEmailsAliasPath = mutablePaths["/emails"];
if (canonicalEmailsPath?.get && existingEmailsAliasPath?.post) {
  mutablePaths["/emails"] = {
    get: canonicalEmailsPath.get,
    post: existingEmailsAliasPath.post,
  };
}
