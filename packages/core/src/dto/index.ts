export interface EmailAttachment {
  filename: string;
  content?: string;
  path?: string;
  content_type?: string;
  content_id?: string;
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailTemplateReference {
  id: string;
  variables?: Record<string, unknown>;
}

export interface EmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  tags?: EmailTag[];
  /**
   * Schedule delivery with a future ISO 8601 date-time including timezone,
   * or `in <positive integer> <minute|min|minutes|hour|hours|day|days>`
   * within 30 days.
   */
  scheduled_at?: string;
  topic_id?: string;
  template?: EmailTemplateReference;
}

export interface EmailResponse {
  id: string;
}

export type SendEmailResponse = EmailResponse;

export type EmailPublicErrorCode =
  | "invalid_json"
  | "validation_error"
  | "missing_api_key"
  | "malformed_api_key"
  | "invalid_api_key"
  | "invalid_idempotency_key"
  | "insufficient_api_key_permission"
  | "api_key_domain_restricted"
  | "idempotency_conflict"
  | "not_found"
  | "quota_exceeded"
  | "recipient_suppressed"
  | "rate_limit_exceeded"
  | "rate_limit_unavailable"
  | "background_worker_unavailable"
  | "internal_server_error";

export type EmailStatus =
  | "queued"
  | "processing"
  | "scheduled"
  | "sent"
  | "failed"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "hard_bounced"
  | "soft_bounced"
  | "complained"
  | "opened"
  | "clicked"
  | "suppressed"
  | "canceled"
  | "cancelled";

export interface EmailListOptions {
  limit?: number;
  after?: string;
  before?: string;
  status?: EmailStatus;
}

export interface ProviderRetryVisibility {
  provider_retry_count: number;
  provider_last_attempted_at: string | null;
  provider_next_retry_at: string | null;
  provider_last_error: {
    code: string;
    message: string;
  } | null;
  provider_dead_lettered_at: string | null;
}

export interface BatchEmailItemError {
  error: {
    name: EmailPublicErrorCode;
    code: EmailPublicErrorCode;
    message: string;
    statusCode: number;
    details?:
      | { formErrors: string[]; fieldErrors: Record<string, string[]> }
      | Record<string, string | number | boolean | null>;
  };
}

export type BatchEmailItemResponse = EmailResponse | BatchEmailItemError;

export interface BatchEmailResponse {
  data: BatchEmailItemResponse[];
}

export interface EmailListItem extends ProviderRetryVisibility {
  id: string;
  from: string;
  to: string[];
  subject: string;
  cc: string[] | null;
  bcc: string[] | null;
  reply_to: string[] | null;
  last_event: EmailStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailListResponse {
  object: "list";
  has_more: boolean;
  data: EmailListItem[];
}

export interface EmailDetailResponse extends EmailListItem {
  object: "email";
  html: string | null;
  text: string | null;
  tags: EmailTag[] | null;
}

export interface DomainCapability {
  name: string;
  enabled: boolean;
}

export interface DomainRecord {
  type: string;
  name: string;
  value: string;
  status: string;
  ttl: string;
  priority?: number;
}

export interface DomainOptions {
  name: string;
  region?: "us-east-1" | "eu-west-1" | "sa-east-1" | "ap-northeast-1";
  custom_return_path?: string;
  open_tracking?: boolean;
  click_tracking?: boolean;
  tracking_subdomain?: string;
  tls?: "opportunistic" | "enforced";
  capabilities?: DomainCapability[];
}

export interface UpdateDomainPayload {
  click_tracking?: boolean;
  open_tracking?: boolean;
  tracking_subdomain?: string | null;
  capabilities?: DomainCapability[];
  sending_enabled?: boolean;
  receiving_enabled?: boolean;
  tls?: "opportunistic" | "enforced";
}

export interface DomainResponse {
  object: "domain";
  id: string;
  name: string;
  status: string;
  region: string;
  records: DomainRecord[];
  custom_return_path?: string | null;
  return_path?: string;
  open_tracking?: boolean;
  click_tracking?: boolean;
  tracking_subdomain?: string | null;
  tls?: "opportunistic" | "enforced";
  capabilities?: DomainCapability[];
  created_at: string;
}

export interface DomainListItem {
  id: string;
  name: string;
  status: string;
  region: string;
  capabilities: DomainCapability[] | null;
  created_at: string;
}

export interface DomainListResponse {
  object: "list";
  data: DomainListItem[];
  has_more: boolean;
}

export interface CreateApiKeyPayload {
  name: string;
  permission?: "full_access" | "sending_access";
  domain_id?: string;
}

export interface ApiKeyResponse {
  id: string;
  token: string;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyListResponse {
  object: "list";
  data: ApiKeyListItem[];
  has_more: boolean;
}

export interface CreateContactPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  unsubscribed?: boolean;
  properties?: Record<string, string>;
  segments?: string[];
  topics?: Array<string | { id: string; subscription: "opt_in" | "opt_out" }>;
}

export interface CreateContactResponse {
  object: "contact";
  id: string;
}

export type UpdateContactPayload = Partial<CreateContactPayload>;

export interface DeleteContactResponse {
  object: "contact";
  id: string;
  deleted: true;
}

export interface ContactTopicPreference {
  id: string;
  subscription: "opt_in" | "opt_out";
}

export interface ContactListTopicPreference extends ContactTopicPreference {
  name: string;
}

export interface ContactResponse {
  object: "contact";
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  properties: Record<string, string> | null;
  segments: string[];
  topics: ContactTopicPreference[];
  created_at: string;
}

export interface ContactListItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  firstName: string | null;
  lastName: string | null;
  status: "subscribed" | "unsubscribed";
  segments: string[];
  topics: ContactListTopicPreference[];
  created_at: string;
}

export interface ContactListResponse {
  object: "list";
  data: ContactListItem[];
  has_more: boolean;
}

export interface CreateSegmentPayload {
  name: string;
}

export interface SegmentResponse {
  object: "segment";
  id: string;
  name: string;
  created_at?: string;
}

export interface SegmentListItem {
  id: string;
  name: string;
  created_at: string;
}

export interface SegmentListResponse {
  object: "list";
  data: SegmentListItem[];
  has_more: boolean;
  total?: number;
}

export interface DeleteSegmentResponse {
  success: true;
}

export interface SegmentContactListItem {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "subscribed" | "unsubscribed";
  created_at: string;
}

export interface SegmentContactListResponse {
  object: "list";
  data: SegmentContactListItem[];
  has_more: boolean;
}

export interface CreateAudiencePayload {
  name: string;
}

export interface AudienceResponse {
  object: "audience";
  id: string;
  name: string;
  created_at?: string;
}

export interface AudienceListItem {
  id: string;
  name: string;
  created_at: string;
}

export interface AudienceListResponse {
  object: "list";
  data: AudienceListItem[];
  has_more: boolean;
}

export interface DeleteAudienceResponse {
  object: "audience";
  id: string;
  deleted: true;
}

export * from "./automations";

// ── Billing DTOs ───────────────────────────────────────────────────

export type BillingBackend = "stripe" | "disabled";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface PlanResponse {
  object: "plan";
  id: string;
  slug: string;
  name: string;
  monthly_price_cents: number;
  monthly_email_quota: number;
  max_domains: number;
  max_api_keys: number;
  stripe_price_id: string | null;
  is_public: boolean;
  created_at: string;
}

export interface SubscriptionResponse {
  object: "subscription";
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StripeCustomerResponse {
  object: "stripe_customer";
  id: string;
  user_id: string;
  stripe_customer_id: string;
  created_at: string;
}

export interface UsagePeriodResponse {
  object: "usage_period";
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  emails_sent: number;
  last_increment_at: string | null;
}

// Entry paid plan slug — the mandatory floor for hosted use after the free tier
// was removed. Self-hosters (billing disabled) are unaffected.
export const ENTRY_PLAN_SLUG = "cloud_lite_15k_monthly";
