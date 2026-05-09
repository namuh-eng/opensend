import type {
  ApiKeyListItem,
  ApiKeyListResponse,
  ApiKeyResponse,
  BatchEmailItemError,
  BatchEmailItemResponse,
  BatchEmailResponse,
  ContactListItem,
  ContactListResponse,
  ContactResponse,
  ContactTopicPreference,
  CreateApiKeyPayload,
  CreateContactPayload,
  CreateContactResponse,
  DeleteContactResponse,
  DomainCapability,
  DomainListItem,
  DomainListResponse,
  DomainOptions,
  DomainRecord,
  DomainResponse,
  EmailAttachment,
  EmailDetailResponse,
  EmailListItem,
  EmailListOptions,
  EmailListResponse,
  EmailOptions,
  EmailResponse,
  EmailStatus,
  EmailTag,
  EmailTemplateReference,
  SendEmailResponse,
  UpdateContactPayload,
  UpdateDomainPayload,
} from "../../core/src/dto";

interface SDKOptions {
  baseUrl?: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
}

export const DEFAULT_BASE_URL = "https://api.opensend.com";

interface ApiError {
  message: string;
  statusCode: number;
  name?: string;
  code?: string;
  details?: Record<string, unknown>;
}

interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export type SendEmailPayload = EmailOptions & {
  react?: unknown;
};
export type CreateDomainPayload = DomainOptions;

export interface AutomationStepPayload {
  key: string;
  type:
    | "trigger"
    | "delay"
    | "send_email"
    | "end"
    | "condition"
    | "wait_for_event"
    | "contact_update"
    | "contact_delete";
  config?: Record<string, unknown>;
  position?: number;
}

export interface AutomationConnectionPayload {
  from: string;
  to: string;
}

export interface CreateAutomationPayload {
  name?: string;
  status?: "draft" | "enabled" | "disabled";
  trigger_event_name?: string;
  triggerEventName?: string;
  steps: AutomationStepPayload[];
  connections?: AutomationConnectionPayload[];
}

export type UpdateAutomationPayload = Partial<CreateAutomationPayload>;

export interface SendEventPayload {
  event: string;
  contact_id?: string;
  contactId?: string;
  email?: string;
  payload?: Record<string, unknown>;
}

export interface CreateEventPayload {
  name: string;
  schema?: Record<string, unknown>;
}

export interface ListOptions {
  limit?: number;
  after?: string;
}

export interface AutomationRunListOptions extends ListOptions {
  status?: string;
}

function normalizeBaseUrl(baseUrl: string = DEFAULT_BASE_URL): string {
  if (!baseUrl.trim()) {
    throw new Error("baseUrl must be a non-empty string when provided");
  }

  let normalized: URL;
  try {
    normalized = new URL(baseUrl);
  } catch {
    throw new Error("baseUrl must be a valid absolute URL");
  }

  if (!["http:", "https:"].includes(normalized.protocol)) {
    throw new Error("baseUrl must use http or https");
  }

  return normalized.toString().replace(/\/$/, "");
}

function getStringProperty(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const property = value[key];
  return typeof property === "string" ? property : null;
}

function getRecordProperty(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const property = value[key];
  return property && typeof property === "object" && !Array.isArray(property)
    ? (property as Record<string, unknown>)
    : null;
}

function parseApiErrorBody(parsedBody: unknown, response: Response): ApiError {
  const errorBody =
    parsedBody && typeof parsedBody === "object"
      ? (parsedBody as Record<string, unknown>)
      : null;

  if (!errorBody) {
    return {
      message: response.statusText || "Request failed",
      statusCode: response.status,
    };
  }

  const message =
    getStringProperty(errorBody, "message") ??
    getStringProperty(errorBody, "error") ??
    response.statusText ??
    "Request failed";
  const name = getStringProperty(errorBody, "name");
  const code = getStringProperty(errorBody, "code");
  const details = getRecordProperty(errorBody, "details");

  return {
    message,
    statusCode: response.status,
    ...(name ? { name } : {}),
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  };
}

async function renderReactToHtml(element: unknown): Promise<string | null> {
  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    return renderToStaticMarkup(
      element as Parameters<typeof renderToStaticMarkup>[0],
    );
  } catch {
    return null;
  }
}

class HttpClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      };
      if (requestOptions.idempotencyKey !== undefined) {
        headers["Idempotency-Key"] = requestOptions.idempotencyKey;
      }

      const options: RequestInit = { method, headers };
      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);
      const rawBody = await response.text();
      const parsedBody = rawBody ? (JSON.parse(rawBody) as unknown) : null;

      if (!response.ok) {
        return {
          data: null,
          error: parseApiErrorBody(parsedBody, response),
        };
      }

      return { data: parsedBody as T | null, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          statusCode: 500,
          name: "internal_server_error",
          code: "internal_server_error",
        },
      };
    }
  }
}

class Emails {
  constructor(private readonly http: HttpClient) {}

  async send(
    payload: SendEmailPayload,
    options: RequestOptions = {},
  ): Promise<ApiResponse<EmailResponse>> {
    const { react, ...rest } = payload;

    if (react != null) {
      const rendered = await renderReactToHtml(react);
      if (rendered) {
        rest.html = rendered;
      }
    }

    return this.http.request<EmailResponse>("POST", "/emails", rest, options);
  }

  async sendBatch(
    payload: SendEmailPayload[],
    options: RequestOptions = {},
  ): Promise<ApiResponse<BatchEmailResponse>> {
    return this.http.request<BatchEmailResponse>(
      "POST",
      "/emails/batch",
      payload,
      options,
    );
  }

  async list(
    options: EmailListOptions = {},
  ): Promise<ApiResponse<EmailListResponse>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options.after) {
      params.set("after", options.after);
    }
    if (options.before) {
      params.set("before", options.before);
    }
    if (options.status) {
      params.set("status", options.status);
    }

    const query = params.toString();
    return this.http.request<EmailListResponse>(
      "GET",
      query ? `/api/emails?${query}` : "/api/emails",
    );
  }

  async get(id: string): Promise<ApiResponse<EmailDetailResponse>> {
    return this.http.request<EmailDetailResponse>("GET", `/api/emails/${id}`);
  }
}

class Domains {
  constructor(private readonly http: HttpClient) {}

  async create(payload: DomainOptions): Promise<ApiResponse<DomainResponse>> {
    return this.http.request<DomainResponse>("POST", "/api/domains", payload);
  }

  async list(): Promise<ApiResponse<DomainListResponse>> {
    return this.http.request<DomainListResponse>("GET", "/api/domains");
  }

  async get(id: string): Promise<ApiResponse<DomainResponse>> {
    return this.http.request<DomainResponse>("GET", `/api/domains/${id}`);
  }

  async update(
    id: string,
    payload: UpdateDomainPayload,
  ): Promise<ApiResponse<Pick<DomainResponse, "object" | "id">>> {
    return this.http.request<Pick<DomainResponse, "object" | "id">>(
      "PATCH",
      `/api/domains/${id}`,
      payload,
    );
  }

  async verify(id: string): Promise<ApiResponse<DomainResponse>> {
    return this.http.request<DomainResponse>(
      "POST",
      `/api/domains/${id}/verify`,
    );
  }
}

class ApiKeys {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateApiKeyPayload,
  ): Promise<ApiResponse<ApiKeyResponse>> {
    return this.http.request<ApiKeyResponse>("POST", "/api/api-keys", payload);
  }

  async list(): Promise<ApiResponse<ApiKeyListResponse>> {
    return this.http.request<ApiKeyListResponse>("GET", "/api/api-keys");
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return this.http.request<null>("DELETE", `/api/api-keys/${id}`);
  }
}

class Contacts {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateContactPayload,
  ): Promise<ApiResponse<CreateContactResponse>> {
    return this.http.request<CreateContactResponse>(
      "POST",
      "/contacts",
      payload,
    );
  }

  async list(): Promise<ApiResponse<ContactListResponse>> {
    return this.http.request<ContactListResponse>("GET", "/contacts");
  }

  async get(id: string): Promise<ApiResponse<ContactResponse>> {
    return this.http.request<ContactResponse>("GET", `/contacts/${id}`);
  }

  async update(
    id: string,
    payload: UpdateContactPayload,
  ): Promise<ApiResponse<ContactResponse>> {
    return this.http.request<ContactResponse>(
      "PATCH",
      `/contacts/${id}`,
      payload,
    );
  }

  async delete(id: string): Promise<ApiResponse<DeleteContactResponse>> {
    return this.http.request<DeleteContactResponse>(
      "DELETE",
      `/contacts/${id}`,
    );
  }
}

class Automations {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateAutomationPayload,
  ): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>("POST", "/api/automations", payload);
  }

  async list(
    options: ListOptions & { status?: string } = {},
  ): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    if (options.status) params.set("status", options.status);
    const query = params.toString();
    return this.http.request<unknown>(
      "GET",
      query ? `/api/automations?${query}` : "/api/automations",
    );
  }

  async get(id: string): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>("GET", `/api/automations/${id}`);
  }

  async update(
    id: string,
    payload: UpdateAutomationPayload,
  ): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>(
      "PATCH",
      `/api/automations/${id}`,
      payload,
    );
  }

  async delete(id: string): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>("DELETE", `/api/automations/${id}`);
  }

  async listRuns(
    id: string,
    options: AutomationRunListOptions = {},
  ): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    if (options.status) params.set("status", options.status);
    const query = params.toString();
    return this.http.request<unknown>(
      "GET",
      query
        ? `/api/automations/${id}/runs?${query}`
        : `/api/automations/${id}/runs`,
    );
  }

  async getRun(id: string, runId: string): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>(
      "GET",
      `/api/automations/${id}/runs/${runId}`,
    );
  }
}

class Events {
  constructor(private readonly http: HttpClient) {}

  async create(payload: CreateEventPayload): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>("POST", "/api/events", payload);
  }

  async list(options: ListOptions = {}): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    const query = params.toString();
    return this.http.request<unknown>(
      "GET",
      query ? `/api/events?${query}` : "/api/events",
    );
  }

  async send(payload: SendEventPayload): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>("POST", "/api/events/send", payload);
  }
}

class Opensend {
  public readonly emails: Emails;
  public readonly domains: Domains;
  public readonly apiKeys: ApiKeys;
  public readonly contacts: Contacts;
  public readonly automations: Automations;
  public readonly events: Events;

  constructor(apiKey: string, options: SDKOptions = {}) {
    if (!apiKey) {
      throw new Error("API key is required");
    }

    const http = new HttpClient(apiKey, normalizeBaseUrl(options.baseUrl));

    this.emails = new Emails(http);
    this.domains = new Domains(http);
    this.apiKeys = new ApiKeys(http);
    this.contacts = new Contacts(http);
    this.automations = new Automations(http);
    this.events = new Events(http);
  }
}

class Resend extends Opensend {}

export { Opensend, Resend };
export type {
  SDKOptions,
  ApiError,
  ApiResponse,
  EmailAttachment,
  EmailOptions,
  EmailResponse,
  SendEmailResponse,
  EmailStatus,
  EmailListOptions,
  BatchEmailItemError,
  BatchEmailItemResponse,
  BatchEmailResponse,
  EmailListItem,
  EmailListResponse,
  EmailTag,
  EmailTemplateReference,
  EmailDetailResponse,
  DomainCapability,
  DomainOptions,
  DomainRecord,
  UpdateDomainPayload,
  DomainResponse,
  DomainListItem,
  DomainListResponse,
  CreateApiKeyPayload,
  ApiKeyResponse,
  ApiKeyListItem,
  ApiKeyListResponse,
  CreateContactPayload,
  CreateContactResponse,
  UpdateContactPayload,
  DeleteContactResponse,
  ContactResponse,
  ContactTopicPreference,
  ContactListItem,
  ContactListResponse,
};
