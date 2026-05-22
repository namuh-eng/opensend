import type { ReactNode } from "react";
import type {
  ApiKeyListItem,
  ApiKeyListResponse,
  ApiKeyResponse,
  AudienceListItem,
  AudienceListResponse,
  AudienceResponse,
  BatchEmailItemError,
  BatchEmailItemResponse,
  BatchEmailResponse,
  ContactListItem,
  ContactListResponse,
  ContactResponse,
  ContactTopicPreference,
  CreateApiKeyPayload,
  CreateAudiencePayload,
  CreateContactPayload,
  CreateContactResponse,
  CreateSegmentPayload,
  DeleteAudienceResponse,
  DeleteContactResponse,
  DeleteSegmentResponse,
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
  SegmentContactListItem,
  SegmentContactListResponse,
  SegmentListItem,
  SegmentListResponse,
  SegmentResponse,
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

export const DEFAULT_BASE_URL = "https://opensend.namuh.co";

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
  replyTo?: string | string[];
  react?: ReactNode;
};
export type CreateDomainPayload = DomainOptions;

interface CancelEmailResponse {
  object: "email";
  id: string;
}

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
    | "contact_delete"
    | "add_to_segment";
  config?: Record<string, unknown>;
  position?: number;
}

export interface AutomationConnectionPayload {
  from: string;
  to: string;
  type?: "default" | "condition_met" | "condition_not_met";
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

export interface AudienceListOptions extends ListOptions {
  search?: string;
}

export interface SegmentListOptions extends ListOptions {
  search?: string;
}

export interface AutomationRunListOptions extends ListOptions {
  status?: string;
}

export interface CancelAutomationRunPayload {
  reason?: string;
}

export interface AutomationRunMetricsOptions {
  from?: string;
  to?: string;
}

type BroadcastStatus = "draft" | "scheduled" | "queued" | "sent" | "failed";

interface BroadcastPayloadAliases {
  segment_id?: string;
  segmentId?: string;
  topic_id?: string;
  topicId?: string;
  reply_to?: string;
  replyTo?: string;
  preview_text?: string;
  previewText?: string;
  scheduled_at?: string;
  scheduledAt?: string;
}

interface CreateBroadcastPayload extends BroadcastPayloadAliases {
  name?: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  send?: boolean;
}

type UpdateBroadcastPayload = Partial<
  Omit<CreateBroadcastPayload, "from" | "subject">
> &
  Partial<Pick<CreateBroadcastPayload, "from" | "subject">>;

type SendBroadcastPayload = Pick<
  BroadcastPayloadAliases,
  "scheduled_at" | "scheduledAt"
>;

interface BroadcastListOptions extends ListOptions {
  search?: string;
  status?: BroadcastStatus;
  segmentId?: string;
}

interface BroadcastListItem {
  id: string;
  name: string;
  status: BroadcastStatus;
  audience_id: string | null;
  topic_id: string | null;
  created_at: string;
  scheduled_at: string | null;
}

interface BroadcastListResponse {
  object: "list";
  data: BroadcastListItem[];
  has_more: boolean;
}

interface BroadcastResponse extends BroadcastListItem {
  object: "broadcast";
  from?: string | null;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  reply_to?: string | null;
  preview_text?: string | null;
}

type CreateBroadcastResponse = Pick<
  BroadcastResponse,
  "object" | "id" | "name" | "status" | "created_at"
>;

interface DeleteBroadcastResponse {
  object: "broadcast";
  id: string;
  deleted: true;
}

type SendBroadcastResponse = Pick<
  BroadcastResponse,
  "object" | "id" | "status" | "scheduled_at"
>;

type TemplateStatus = "draft" | "published";
type TemplateVariableType = "string" | "number";

interface TemplateVariable {
  key: string;
  name?: string;
  type?: TemplateVariableType;
  required?: boolean;
  fallback_value?: string | number | null;
  fallbackValue?: string | number | null;
}

interface TemplatePayloadAliases {
  reply_to?: string | string[] | null;
  replyTo?: string | string[] | null;
  preview_text?: string | null;
  previewText?: string | null;
}

interface CreateTemplatePayload extends TemplatePayloadAliases {
  name: string;
  alias?: string | null;
  from?: string | null;
  subject?: string | null;
  html?: string;
  text?: string | null;
  variables?: TemplateVariable[];
}

type UpdateTemplatePayload = Partial<CreateTemplatePayload> & {
  status?: TemplateStatus;
};

interface TemplateListOptions extends ListOptions {
  search?: string;
  status?: TemplateStatus;
}

interface TemplateListItem {
  object: "template";
  id: string;
  name: string;
  alias: string | null;
  status: TemplateStatus;
  current_version_id?: string | null;
  published_at?: string | null;
  has_unpublished_versions?: boolean;
  created_at: string;
}

interface TemplateListResponse {
  object: "list";
  data: TemplateListItem[];
  has_more: boolean;
}

interface TemplateResponse extends TemplateListItem {
  subject?: string | null;
  from?: string | null;
  reply_to?: string | string[] | null;
  preview_text?: string | null;
  html?: string | null;
  text?: string | null;
  variables?: TemplateVariable[];
  updated_at?: string | null;
}

type CreateTemplateResponse = Pick<TemplateResponse, "object" | "id">;
type UpdateTemplateResponse = Pick<TemplateResponse, "object" | "id">;
type PublishTemplateResponse = Pick<TemplateResponse, "object" | "id">;
type DuplicateTemplateResponse = Pick<TemplateResponse, "object" | "id">;

interface DeleteTemplateResponse {
  object: "template";
  id: string;
  deleted: true;
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

function toBroadcastPayload<T extends BroadcastPayloadAliases>(
  payload: T,
): Omit<
  T,
  "segmentId" | "topicId" | "replyTo" | "previewText" | "scheduledAt"
> {
  const { segmentId, topicId, replyTo, previewText, scheduledAt, ...rest } =
    payload;
  const normalized = { ...rest };

  if (normalized.segment_id === undefined && segmentId !== undefined) {
    normalized.segment_id = segmentId;
  }
  if (normalized.topic_id === undefined && topicId !== undefined) {
    normalized.topic_id = topicId;
  }
  if (normalized.reply_to === undefined && replyTo !== undefined) {
    normalized.reply_to = replyTo;
  }
  if (normalized.preview_text === undefined && previewText !== undefined) {
    normalized.preview_text = previewText;
  }
  if (normalized.scheduled_at === undefined && scheduledAt !== undefined) {
    normalized.scheduled_at = scheduledAt;
  }

  return normalized;
}

function toTemplatePayload<T extends TemplatePayloadAliases>(
  payload: T,
): Omit<T, "replyTo" | "previewText"> {
  const { replyTo, previewText, ...rest } = payload;
  const normalized = { ...rest };

  if (normalized.reply_to === undefined && replyTo !== undefined) {
    normalized.reply_to = replyTo;
  }
  if (normalized.preview_text === undefined && previewText !== undefined) {
    normalized.preview_text = previewText;
  }

  return normalized;
}

type SendEmailRestPayload = Omit<SendEmailPayload, "replyTo">;

function toSendEmailPayload(payload: SendEmailPayload): SendEmailRestPayload {
  const { replyTo, ...rest } = payload;
  const normalized: SendEmailRestPayload = { ...rest };

  if (normalized.reply_to === undefined && replyTo !== undefined) {
    normalized.reply_to = replyTo;
  }

  return normalized;
}

interface ReactRenderSuccess {
  html: string;
  error: null;
}

interface ReactRenderFailure {
  html: null;
  error: ApiError;
}

type ReactRenderResult = ReactRenderSuccess | ReactRenderFailure;

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createReactRenderError(error: unknown): ApiError {
  const cause = formatUnknownError(error);

  return {
    message:
      "Unable to render React email in the OpenSend SDK. Install react and react-dom in your application, then pass a renderable React element to emails.send({ react }).",
    statusCode: 500,
    name: "react_render_error",
    code: "react_render_error",
    details: { cause },
  };
}

async function renderReactToHtml(
  element: ReactNode,
): Promise<ReactRenderResult> {
  try {
    const renderer = await import("react-dom/server");
    if (typeof renderer.renderToStaticMarkup !== "function") {
      throw new Error(
        "react-dom/server is unavailable: renderToStaticMarkup export was not found.",
      );
    }

    return { html: renderer.renderToStaticMarkup(element), error: null };
  } catch (error) {
    return { html: null, error: createReactRenderError(error) };
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
    const { react, ...rest } = toSendEmailPayload(payload);

    if (react != null) {
      const rendered = await renderReactToHtml(react);
      if (rendered.error) {
        return { data: null, error: rendered.error };
      }
      rest.html = rendered.html;
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
      payload.map(toSendEmailPayload),
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

  async cancel(id: string): Promise<ApiResponse<CancelEmailResponse>> {
    return this.http.request<CancelEmailResponse>(
      "POST",
      `/emails/${id}/cancel`,
    );
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
    return this.http.request<ApiKeyResponse>("POST", "/api-keys", payload);
  }

  async list(): Promise<ApiResponse<ApiKeyListResponse>> {
    return this.http.request<ApiKeyListResponse>("GET", "/api-keys");
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return this.http.request<null>("DELETE", `/api-keys/${id}`);
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

class Segments {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateSegmentPayload,
  ): Promise<ApiResponse<SegmentResponse>> {
    return this.http.request<SegmentResponse>("POST", "/segments", payload);
  }

  async list(
    options: SegmentListOptions = {},
  ): Promise<ApiResponse<SegmentListResponse>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    if (options.search) params.set("search", options.search);

    const query = params.toString();
    return this.http.request<SegmentListResponse>(
      "GET",
      query ? `/segments?${query}` : "/segments",
    );
  }

  async get(id: string): Promise<ApiResponse<SegmentResponse>> {
    return this.http.request<SegmentResponse>("GET", `/segments/${id}`);
  }

  async delete(id: string): Promise<ApiResponse<DeleteSegmentResponse>> {
    return this.http.request<DeleteSegmentResponse>(
      "DELETE",
      `/segments/${id}`,
    );
  }

  async listContacts(
    id: string,
    options: ListOptions = {},
  ): Promise<ApiResponse<SegmentContactListResponse>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);

    const query = params.toString();
    return this.http.request<SegmentContactListResponse>(
      "GET",
      query ? `/segments/${id}/contacts?${query}` : `/segments/${id}/contacts`,
    );
  }
}

class Audiences {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateAudiencePayload,
  ): Promise<ApiResponse<AudienceResponse>> {
    return this.http.request<AudienceResponse>("POST", "/audiences", payload);
  }

  async list(
    options: AudienceListOptions = {},
  ): Promise<ApiResponse<AudienceListResponse>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    if (options.search) params.set("search", options.search);

    const query = params.toString();
    return this.http.request<AudienceListResponse>(
      "GET",
      query ? `/audiences?${query}` : "/audiences",
    );
  }

  async get(id: string): Promise<ApiResponse<AudienceResponse>> {
    return this.http.request<AudienceResponse>("GET", `/audiences/${id}`);
  }

  async delete(id: string): Promise<ApiResponse<DeleteAudienceResponse>> {
    return this.http.request<DeleteAudienceResponse>(
      "DELETE",
      `/audiences/${id}`,
    );
  }
}

class Broadcasts {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateBroadcastPayload,
    options: RequestOptions = {},
  ): Promise<ApiResponse<CreateBroadcastResponse>> {
    return this.http.request<CreateBroadcastResponse>(
      "POST",
      "/broadcasts",
      toBroadcastPayload(payload),
      options,
    );
  }

  async list(
    options: BroadcastListOptions = {},
  ): Promise<ApiResponse<BroadcastListResponse>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    if (options.search) params.set("search", options.search);
    if (options.status) params.set("status", options.status);
    if (options.segmentId) params.set("segmentId", options.segmentId);

    const query = params.toString();
    return this.http.request<BroadcastListResponse>(
      "GET",
      query ? `/broadcasts?${query}` : "/broadcasts",
    );
  }

  async get(id: string): Promise<ApiResponse<BroadcastResponse>> {
    return this.http.request<BroadcastResponse>("GET", `/broadcasts/${id}`);
  }

  async update(
    id: string,
    payload: UpdateBroadcastPayload,
  ): Promise<ApiResponse<BroadcastResponse>> {
    return this.http.request<BroadcastResponse>(
      "PATCH",
      `/broadcasts/${id}`,
      toBroadcastPayload(payload),
    );
  }

  async delete(id: string): Promise<ApiResponse<DeleteBroadcastResponse>> {
    return this.http.request<DeleteBroadcastResponse>(
      "DELETE",
      `/broadcasts/${id}`,
    );
  }

  async send(
    id: string,
    payload: SendBroadcastPayload = {},
    options: RequestOptions = {},
  ): Promise<ApiResponse<SendBroadcastResponse>> {
    return this.http.request<SendBroadcastResponse>(
      "POST",
      `/broadcasts/${id}/send`,
      toBroadcastPayload(payload),
      options,
    );
  }
}

class Templates {
  constructor(private readonly http: HttpClient) {}

  async create(
    payload: CreateTemplatePayload,
  ): Promise<ApiResponse<CreateTemplateResponse>> {
    return this.http.request<CreateTemplateResponse>(
      "POST",
      "/templates",
      toTemplatePayload(payload),
    );
  }

  async list(
    options: TemplateListOptions = {},
  ): Promise<ApiResponse<TemplateListResponse>> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after) params.set("after", options.after);
    if (options.search) params.set("search", options.search);
    if (options.status) params.set("status", options.status);

    const query = params.toString();
    return this.http.request<TemplateListResponse>(
      "GET",
      query ? `/templates?${query}` : "/templates",
    );
  }

  async get(idOrAlias: string): Promise<ApiResponse<TemplateResponse>> {
    return this.http.request<TemplateResponse>(
      "GET",
      `/templates/${idOrAlias}`,
    );
  }

  async update(
    idOrAlias: string,
    payload: UpdateTemplatePayload,
  ): Promise<ApiResponse<UpdateTemplateResponse>> {
    return this.http.request<UpdateTemplateResponse>(
      "PATCH",
      `/templates/${idOrAlias}`,
      toTemplatePayload(payload),
    );
  }

  async delete(
    idOrAlias: string,
  ): Promise<ApiResponse<DeleteTemplateResponse>> {
    return this.http.request<DeleteTemplateResponse>(
      "DELETE",
      `/templates/${idOrAlias}`,
    );
  }

  async publish(
    idOrAlias: string,
  ): Promise<ApiResponse<PublishTemplateResponse>> {
    return this.http.request<PublishTemplateResponse>(
      "POST",
      `/templates/${idOrAlias}/publish`,
    );
  }

  async duplicate(
    idOrAlias: string,
  ): Promise<ApiResponse<DuplicateTemplateResponse>> {
    return this.http.request<DuplicateTemplateResponse>(
      "POST",
      `/templates/${idOrAlias}/duplicate`,
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

  async cancelRun(
    id: string,
    runId: string,
    payload: CancelAutomationRunPayload = {},
  ): Promise<ApiResponse<unknown>> {
    return this.http.request<unknown>(
      "POST",
      `/api/automations/${id}/runs/${runId}/cancel`,
      payload,
    );
  }

  async getRunMetrics(
    id: string,
    options: AutomationRunMetricsOptions = {},
  ): Promise<ApiResponse<unknown>> {
    const params = new URLSearchParams();
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    const query = params.toString();
    return this.http.request<unknown>(
      "GET",
      query
        ? `/api/automations/${id}/runs/metrics?${query}`
        : `/api/automations/${id}/runs/metrics`,
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
  public readonly segments: Segments;
  public readonly audiences: Audiences;
  public readonly broadcasts: Broadcasts;
  public readonly templates: Templates;
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
    this.segments = new Segments(http);
    this.audiences = new Audiences(http);
    this.broadcasts = new Broadcasts(http);
    this.templates = new Templates(http);
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
  CancelEmailResponse,
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
  CreateAudiencePayload,
  AudienceResponse,
  AudienceListItem,
  AudienceListResponse,
  DeleteAudienceResponse,
  CreateSegmentPayload,
  SegmentResponse,
  SegmentListItem,
  SegmentListResponse,
  DeleteSegmentResponse,
  SegmentContactListItem,
  SegmentContactListResponse,
  BroadcastStatus,
  CreateBroadcastPayload,
  UpdateBroadcastPayload,
  SendBroadcastPayload,
  BroadcastListOptions,
  BroadcastListItem,
  BroadcastListResponse,
  BroadcastResponse,
  CreateBroadcastResponse,
  DeleteBroadcastResponse,
  SendBroadcastResponse,
  TemplateStatus,
  TemplateVariable,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  TemplateListOptions,
  TemplateListItem,
  TemplateListResponse,
  TemplateResponse,
  CreateTemplateResponse,
  UpdateTemplateResponse,
  DeleteTemplateResponse,
  PublishTemplateResponse,
  DuplicateTemplateResponse,
  CreateContactPayload,
  CreateContactResponse,
  UpdateContactPayload,
  DeleteContactResponse,
  ContactResponse,
  ContactTopicPreference,
  ContactListItem,
  ContactListResponse,
};
