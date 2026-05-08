import type { JsonObject, JsonValue, OpensendMcpToolName } from "./schema";

export type OpensendApiClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
};

export type OpensendApiResult = {
  status: number;
  ok: boolean;
  body: JsonValue;
};

const DEFAULT_BASE_URL = "http://localhost:3015";

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) return value.map(toJsonValue);

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]),
    );
  }

  return String(value);
}

function getStringArgument(args: JsonObject, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required string argument: ${key}`);
  }
  return value;
}

function getOptionalStringArgument(
  args: JsonObject,
  key: string,
): string | null {
  const value = args[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function appendPagination(search: URLSearchParams, args: JsonObject): void {
  const limit = args.limit;
  if (typeof limit === "number" && Number.isFinite(limit)) {
    search.set("limit", String(Math.trunc(limit)));
  }
  const after = getOptionalStringArgument(args, "after");
  if (after) search.set("after", after);
  const before = getOptionalStringArgument(args, "before");
  if (before) search.set("before", before);
}

function bodyFromArgs(args: JsonObject, keys: string[]): JsonObject {
  const body: JsonObject = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(args, key)) {
      body[key] = args[key];
    }
  }
  return body;
}

export class OpensendApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: OpensendApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetcher = options.fetcher ?? fetch;
  }

  async callTool(
    name: OpensendMcpToolName,
    args: JsonObject,
  ): Promise<OpensendApiResult> {
    switch (name) {
      case "opensend_send_email":
        return await this.request(
          "POST",
          "/api/emails",
          bodyFromArgs(args, [
            "from",
            "to",
            "subject",
            "html",
            "text",
            "cc",
            "bcc",
            "reply_to",
            "headers",
            "tags",
            "scheduled_at",
            "topic_id",
            "template",
          ]),
        );
      case "opensend_list_emails":
        return await this.list("/api/emails", args);
      case "opensend_get_email":
        return await this.request(
          "GET",
          `/api/emails/${encodeURIComponent(getStringArgument(args, "id"))}`,
        );
      case "opensend_create_contact":
        return await this.request(
          "POST",
          "/api/contacts",
          bodyFromArgs(args, [
            "email",
            "first_name",
            "last_name",
            "unsubscribed",
            "properties",
            "segments",
            "topics",
          ]),
        );
      case "opensend_list_contacts":
        return await this.list("/api/contacts", args);
      case "opensend_get_contact":
        return await this.request(
          "GET",
          `/api/contacts/${encodeURIComponent(getStringArgument(args, "id"))}`,
        );
      case "opensend_create_domain":
        return await this.request(
          "POST",
          "/api/domains",
          bodyFromArgs(args, [
            "name",
            "region",
            "custom_return_path",
            "open_tracking",
            "click_tracking",
            "tracking_subdomain",
            "tls",
          ]),
        );
      case "opensend_list_domains":
        return await this.list("/api/domains", args);
      case "opensend_get_domain":
        return await this.request(
          "GET",
          `/api/domains/${encodeURIComponent(getStringArgument(args, "id"))}`,
        );
      case "opensend_create_webhook":
        return await this.request(
          "POST",
          "/api/webhooks",
          bodyFromArgs(args, ["endpoint", "events"]),
        );
      case "opensend_list_webhooks":
        return await this.list("/api/webhooks", args);
      case "opensend_get_webhook":
        return await this.request(
          "GET",
          `/api/webhooks/${encodeURIComponent(getStringArgument(args, "id"))}`,
        );
    }
  }

  private async list(
    path: string,
    args: JsonObject,
  ): Promise<OpensendApiResult> {
    const search = new URLSearchParams();
    appendPagination(search, args);
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return await this.request("GET", `${path}${suffix}`);
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: JsonObject,
  ): Promise<OpensendApiResult> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: JsonValue = null;
    if (text) {
      try {
        parsed = toJsonValue(JSON.parse(text));
      } catch {
        parsed = text;
      }
    }

    return { status: response.status, ok: response.ok, body: parsed };
  }
}
