export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type JsonSchema = {
  type: "object";
  properties: Record<string, JsonValue>;
  required?: string[];
  additionalProperties: boolean;
};

export type McpTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

const paginationProperties = {
  limit: {
    type: "integer",
    minimum: 1,
    maximum: 100,
    description: "Maximum number of records to return.",
  },
  after: {
    type: "string",
    description: "Opaque cursor/id for fetching the next page when supported.",
  },
} satisfies Record<string, JsonValue>;

const idProperties = {
  id: { type: "string", description: "OpenSend resource id." },
} satisfies Record<string, JsonValue>;

export const OPENSEND_MCP_TOOLS = [
  {
    name: "opensend_send_email",
    description:
      "Send or schedule one email through the existing OpenSend POST /api/emails API.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["from", "to", "subject"],
      properties: {
        from: { type: "string", description: "Sender email address." },
        to: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "Recipient email address or addresses.",
        },
        subject: { type: "string" },
        html: { type: "string" },
        text: { type: "string" },
        cc: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
        },
        bcc: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
        },
        reply_to: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
        },
        headers: { type: "object", additionalProperties: { type: "string" } },
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
            additionalProperties: false,
          },
        },
        scheduled_at: {
          type: "string",
          description: "ISO-8601 scheduled send timestamp.",
        },
        topic_id: { type: "string" },
        template: {
          type: "object",
          properties: { id: { type: "string" }, variables: { type: "object" } },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    name: "opensend_list_emails",
    description: "List sent/scheduled email records through GET /api/emails.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...paginationProperties,
        before: {
          type: "string",
          description:
            "Cursor/id for fetching records before this id when supported.",
        },
      },
    },
  },
  {
    name: "opensend_get_email",
    description: "Fetch one email record through GET /api/emails/{id}.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: idProperties,
    },
  },
  {
    name: "opensend_create_contact",
    description: "Create one contact through POST /api/contacts.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["email"],
      properties: {
        email: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        unsubscribed: { type: "boolean" },
        properties: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        segments: { type: "array", items: { type: "string" } },
        topics: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "object" }] },
        },
      },
    },
  },
  {
    name: "opensend_list_contacts",
    description: "List contacts through GET /api/contacts.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: paginationProperties,
    },
  },
  {
    name: "opensend_get_contact",
    description: "Fetch one contact through GET /api/contacts/{id}.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: idProperties,
    },
  },
  {
    name: "opensend_create_domain",
    description: "Create one sending domain through POST /api/domains.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
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
      },
    },
  },
  {
    name: "opensend_list_domains",
    description: "List domains through GET /api/domains.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: paginationProperties,
    },
  },
  {
    name: "opensend_get_domain",
    description: "Fetch one domain through GET /api/domains/{id}.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: idProperties,
    },
  },
  {
    name: "opensend_create_webhook",
    description: "Create one webhook endpoint through POST /api/webhooks.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["endpoint", "events"],
      properties: {
        endpoint: { type: "string", description: "Webhook destination URL." },
        events: { type: "array", items: { type: "string" }, minItems: 1 },
      },
    },
  },
  {
    name: "opensend_list_webhooks",
    description: "List webhooks through GET /api/webhooks.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: paginationProperties,
    },
  },
  {
    name: "opensend_get_webhook",
    description: "Fetch one webhook through GET /api/webhooks/{id}.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: idProperties,
    },
  },
] as const satisfies readonly McpTool[];

export type OpensendMcpToolName = (typeof OPENSEND_MCP_TOOLS)[number]["name"];

export function listMcpTools(): McpTool[] {
  return OPENSEND_MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}
