"""Shared TypedDict payload and response types for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, Union

try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Common
# ---------------------------------------------------------------------------

JsonObject = dict[str, Any]
EmailAddress = Union[str, Sequence[str]]


# ---------------------------------------------------------------------------
# Emails
# ---------------------------------------------------------------------------


class EmailAttachment(TypedDict, total=False):
    filename: str
    content: str
    path: str
    content_type: str
    content_id: str


class EmailTag(TypedDict):
    name: str
    value: str


class EmailTemplateReference(TypedDict, total=False):
    id: str
    variables: Mapping[str, Any]


SendParams = TypedDict(
    "SendParams",
    {
        "from": str,
        "from_": str,
        "from_email": str,
        "to": EmailAddress,
        "subject": str,
        "html": str,
        "text": str,
        "cc": EmailAddress,
        "bcc": EmailAddress,
        "reply_to": EmailAddress,
        "headers": Mapping[str, str],
        "attachments": Sequence[EmailAttachment],
        "tags": Sequence[EmailTag],
        "scheduled_at": str,
        "topic_id": str,
        "template": EmailTemplateReference,
    },
    total=False,
)


class EmailResponse(TypedDict):
    id: str


class BatchEmailResponse(TypedDict):
    data: list[EmailResponse]


class EmailListOptions(TypedDict, total=False):
    limit: int
    after: str
    before: str
    status: str


class EmailListItem(TypedDict, total=False):
    id: str
    created_at: str
    status: str
    subject: str
    to: list[str]


class EmailListResponse(TypedDict):
    object: str
    data: list[EmailListItem]
    has_more: bool


class EmailDetailResponse(TypedDict, total=False):
    object: str
    id: str
    created_at: str
    status: str
    subject: str
    to: list[str]
    from_: str
    html: str
    text: str


class CancelEmailResponse(TypedDict):
    object: str
    id: str


# ---------------------------------------------------------------------------
# Domains
# ---------------------------------------------------------------------------


class DomainRecord(TypedDict, total=False):
    record: str
    name: str
    type: str
    ttl: str
    status: str
    value: str
    priority: int


class DomainResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    status: str
    created_at: str
    region: str
    records: list[DomainRecord]


class DomainListItem(TypedDict, total=False):
    id: str
    name: str
    status: str
    created_at: str
    region: str


class DomainListResponse(TypedDict):
    object: str
    data: list[DomainListItem]


class CreateDomainPayload(TypedDict, total=False):
    name: str
    region: str


class UpdateDomainPayload(TypedDict, total=False):
    open_tracking: bool
    click_tracking: bool
    tls: str


class DeleteDomainResponse(TypedDict):
    object: str
    id: str
    deleted: bool


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------


class CreateApiKeyPayload(TypedDict, total=False):
    name: str
    permission: str
    domain_id: str


class ApiKeyResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    token: str
    created_at: str


class ApiKeyListItem(TypedDict, total=False):
    id: str
    name: str
    created_at: str


class ApiKeyListResponse(TypedDict):
    object: str
    data: list[ApiKeyListItem]


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------


class ContactTopicPreference(TypedDict, total=False):
    topic_id: str
    subscription_status: str


class CreateContactPayload(TypedDict, total=False):
    email: str
    first_name: str
    last_name: str
    unsubscribed: bool
    audience_id: str
    topic_preferences: list[ContactTopicPreference]


class CreateContactResponse(TypedDict, total=False):
    object: str
    id: str


class ContactResponse(TypedDict, total=False):
    object: str
    id: str
    email: str
    first_name: str
    last_name: str
    unsubscribed: bool
    created_at: str


class ContactListItem(TypedDict, total=False):
    id: str
    email: str
    first_name: str
    last_name: str
    unsubscribed: bool
    created_at: str


class ContactListResponse(TypedDict):
    object: str
    data: list[ContactListItem]
    has_more: bool


class UpdateContactPayload(TypedDict, total=False):
    email: str
    first_name: str
    last_name: str
    unsubscribed: bool
    topic_preferences: list[ContactTopicPreference]


class DeleteContactResponse(TypedDict):
    object: str
    id: str
    deleted: bool


# ---------------------------------------------------------------------------
# Segments
# ---------------------------------------------------------------------------


class CreateSegmentPayload(TypedDict, total=False):
    name: str
    filters: list[JsonObject]


class SegmentResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    created_at: str


class SegmentListItem(TypedDict, total=False):
    id: str
    name: str
    created_at: str


class SegmentListOptions(TypedDict, total=False):
    limit: int
    after: str
    search: str


class SegmentListResponse(TypedDict):
    object: str
    data: list[SegmentListItem]
    has_more: bool


class DeleteSegmentResponse(TypedDict):
    object: str
    id: str
    deleted: bool


class SegmentContactListItem(TypedDict, total=False):
    id: str
    email: str
    first_name: str
    last_name: str
    created_at: str


class SegmentContactListResponse(TypedDict):
    object: str
    data: list[SegmentContactListItem]
    has_more: bool


# ---------------------------------------------------------------------------
# Audiences
# ---------------------------------------------------------------------------


class CreateAudiencePayload(TypedDict, total=False):
    name: str


class AudienceResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    created_at: str


class AudienceListItem(TypedDict, total=False):
    id: str
    name: str
    created_at: str


class AudienceListOptions(TypedDict, total=False):
    limit: int
    after: str
    search: str


class AudienceListResponse(TypedDict):
    object: str
    data: list[AudienceListItem]
    has_more: bool


class DeleteAudienceResponse(TypedDict):
    object: str
    id: str
    deleted: bool


# ---------------------------------------------------------------------------
# Broadcasts
# ---------------------------------------------------------------------------

BroadcastStatus = str  # "draft" | "scheduled" | "queued" | "sent" | "failed"


class CreateBroadcastPayload(TypedDict, total=False):
    name: str
    from_: str  # use from_ (Python keyword alias) or "from" key in dict
    subject: str
    html: str
    text: str
    send: bool
    segment_id: str
    segment_id_alias: str  # segmentId
    topic_id: str
    topic_id_alias: str  # topicId
    reply_to: str
    preview_text: str
    scheduled_at: str


class UpdateBroadcastPayload(TypedDict, total=False):
    name: str
    subject: str
    html: str
    text: str
    send: bool
    segment_id: str
    topic_id: str
    reply_to: str
    preview_text: str
    scheduled_at: str


class SendBroadcastPayload(TypedDict, total=False):
    scheduled_at: str


class BroadcastListOptions(TypedDict, total=False):
    limit: int
    after: str
    search: str
    status: str
    segment_id: str


class BroadcastListItem(TypedDict, total=False):
    id: str
    name: str
    status: str
    audience_id: Optional[str]
    topic_id: Optional[str]
    created_at: str
    scheduled_at: Optional[str]


class BroadcastListResponse(TypedDict):
    object: str
    data: list[BroadcastListItem]
    has_more: bool


class BroadcastResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    status: str
    audience_id: Optional[str]
    topic_id: Optional[str]
    created_at: str
    scheduled_at: Optional[str]
    from_email: str
    subject: str
    html: Optional[str]
    text: Optional[str]
    reply_to: Optional[str]
    preview_text: Optional[str]


class CreateBroadcastResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    status: str
    created_at: str


class DeleteBroadcastResponse(TypedDict):
    object: str
    id: str
    deleted: bool


class SendBroadcastResponse(TypedDict, total=False):
    object: str
    id: str
    status: str
    scheduled_at: Optional[str]


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

TemplateStatus = str  # "draft" | "published"
TemplateVariableType = str  # "string" | "number"


class TemplateVariable(TypedDict, total=False):
    key: str
    name: str
    type: str
    required: bool
    fallback_value: Optional[Union[str, int]]


class CreateTemplatePayload(TypedDict, total=False):
    name: str
    alias: Optional[str]
    from_email: Optional[str]
    subject: Optional[str]
    html: str
    text: Optional[str]
    reply_to: Optional[Union[str, list[str]]]
    preview_text: Optional[str]
    variables: list[TemplateVariable]


class UpdateTemplatePayload(TypedDict, total=False):
    name: str
    alias: Optional[str]
    from_email: Optional[str]
    subject: Optional[str]
    html: str
    text: Optional[str]
    reply_to: Optional[Union[str, list[str]]]
    preview_text: Optional[str]
    variables: list[TemplateVariable]
    status: str


class TemplateListOptions(TypedDict, total=False):
    limit: int
    after: str
    search: str
    status: str


class TemplateListItem(TypedDict, total=False):
    object: str
    id: str
    name: str
    alias: Optional[str]
    status: str
    current_version_id: Optional[str]
    published_at: Optional[str]
    has_unpublished_versions: bool
    created_at: str


class TemplateListResponse(TypedDict):
    object: str
    data: list[TemplateListItem]
    has_more: bool


class TemplateResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    alias: Optional[str]
    status: str
    subject: Optional[str]
    from_email: Optional[str]
    reply_to: Optional[Union[str, list[str]]]
    preview_text: Optional[str]
    html: Optional[str]
    text: Optional[str]
    variables: list[TemplateVariable]
    created_at: str
    updated_at: Optional[str]


class CreateTemplateResponse(TypedDict, total=False):
    object: str
    id: str


class UpdateTemplateResponse(TypedDict, total=False):
    object: str
    id: str


class PublishTemplateResponse(TypedDict, total=False):
    object: str
    id: str


class DuplicateTemplateResponse(TypedDict, total=False):
    object: str
    id: str


class DeleteTemplateResponse(TypedDict):
    object: str
    id: str
    deleted: bool


# ---------------------------------------------------------------------------
# Automations
# ---------------------------------------------------------------------------

AutomationStatus = str  # "draft" | "enabled" | "disabled"
AutomationRunStatus = str  # "queued"|"running"|"waiting"|"completed"|"failed"|"cancelled"|"skipped"


class AutomationStepPayload(TypedDict, total=False):
    key: str
    type: str
    config: JsonObject
    position: int


class AutomationConnectionPayload(TypedDict, total=False):
    from_key: str  # note: "from" is a reserved word; use from_key or pass as dict
    to: str
    type: str


class CreateAutomationPayload(TypedDict, total=False):
    name: str
    status: str
    trigger_event_name: str
    steps: list[AutomationStepPayload]
    connections: list[AutomationConnectionPayload]


class AutomationStepResponse(TypedDict, total=False):
    id: str
    key: str
    type: str
    config: JsonObject
    position: int


class AutomationListItem(TypedDict, total=False):
    object: str
    id: str
    name: str
    status: str
    trigger_event_name: Optional[str]
    created_at: str
    updated_at: str
    step_count: int
    last_run: Optional[JsonObject]


class AutomationListResponse(TypedDict):
    object: str
    data: list[AutomationListItem]
    has_more: bool


class AutomationDetailResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    status: str
    trigger_event_name: Optional[str]
    connections: list[AutomationConnectionPayload]
    steps: list[AutomationStepResponse]
    created_at: str
    updated_at: str


class AutomationDeleteResponse(TypedDict):
    object: str
    id: str
    deleted: bool


class AutomationRunStepState(TypedDict, total=False):
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    scheduled_for: Optional[str]
    error: Optional[str]
    output: Optional[JsonObject]


class AutomationRunListItem(TypedDict, total=False):
    object: str
    id: str
    automation_id: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    duration_ms: Optional[int]
    current_step_key: Optional[str]
    failed_step_key: Optional[str]
    failure_reason: Optional[str]
    next_step_at: Optional[str]
    created_at: str
    updated_at: str


class AutomationRunDetailItem(TypedDict, total=False):
    object: str
    id: str
    automation_id: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    duration_ms: Optional[int]
    current_step_key: Optional[str]
    failed_step_key: Optional[str]
    failure_reason: Optional[str]
    next_step_at: Optional[str]
    created_at: str
    updated_at: str
    trigger_event_id: Optional[str]
    contact_id: Optional[str]
    step_states: dict[str, AutomationRunStepState]


class AutomationRunListResponse(TypedDict):
    object: str
    data: list[AutomationRunListItem]
    has_more: bool


class AutomationRunListOptions(TypedDict, total=False):
    limit: int
    after: str
    status: str


class CancelAutomationRunPayload(TypedDict, total=False):
    reason: str


class AutomationRunMetricsFailedStep(TypedDict):
    step_key: str
    count: int


class AutomationRunMetricsResponse(TypedDict, total=False):
    object: str
    automation_id: str
    total_runs: int
    by_status: dict[str, int]
    completion_rate: float
    failure_rate: float
    average_duration_ms: Optional[float]
    waiting_count: int
    failed_steps: list[AutomationRunMetricsFailedStep]
    range: dict[str, Optional[str]]


class AutomationRunMetricsOptions(TypedDict, total=False):
    from_date: str  # maps to "from"
    to_date: str    # maps to "to"


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class CreateEventPayload(TypedDict, total=False):
    name: str
    schema: JsonObject


class CustomEvent(TypedDict, total=False):
    object: str
    id: str
    name: str
    schema: Optional[JsonObject]
    created_at: str
    updated_at: str


class CustomEventListResponse(TypedDict):
    object: str
    data: list[CustomEvent]
    has_more: bool


class CustomEventDeleteResponse(TypedDict):
    object: str
    id: str
    deleted: bool


class CustomEventDelivery(TypedDict, total=False):
    object: str
    id: str
    event: str
    contact_id: Optional[str]
    email: Optional[str]
    payload: Optional[JsonObject]
    received_at: str


class SendCustomEventResponse(TypedDict, total=False):
    object: str
    delivery: CustomEventDelivery
    resumed_runs: list[JsonObject]
    automation_runs: list[JsonObject]


class SendEventPayload(TypedDict, total=False):
    event: str
    contact_id: str
    email: str
    payload: JsonObject


class ListOptions(TypedDict, total=False):
    limit: int
    after: str


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------

WebhookStatus = str  # "enabled" | "disabled"


class CreateWebhookPayload(TypedDict, total=False):
    endpoint: str
    url: str
    events: list[str]
    event_types: list[str]


class UpdateWebhookPayload(TypedDict, total=False):
    endpoint: str
    url: str
    events: list[str]
    event_types: list[str]
    status: str
    active: bool


class WebhookDeliveryItem(TypedDict, total=False):
    id: str
    status: str
    attempt: int
    status_code: Optional[int]
    response_body: Optional[str]
    attempted_at: Optional[str]
    next_retry_at: Optional[str]
    created_at: str


class WebhookListItem(TypedDict, total=False):
    id: str
    endpoint: str
    events: list[str]
    status: str
    created_at: str


class WebhookListResponse(TypedDict):
    object: str
    data: list[WebhookListItem]
    has_more: bool


class WebhookResponse(TypedDict, total=False):
    object: str
    id: str
    endpoint: str
    events: list[str]
    status: str
    created_at: str


class WebhookCreateResponse(TypedDict, total=False):
    object: str
    id: str
    endpoint: str
    events: list[str]
    status: str
    created_at: str
    signing_secret: str


class WebhookDetailResponse(TypedDict, total=False):
    object: str
    id: str
    endpoint: str
    events: list[str]
    status: str
    created_at: str
    recent_deliveries: list[WebhookDeliveryItem]


class WebhookUpdateResponse(TypedDict, total=False):
    object: str
    id: str
    endpoint: str
    events: list[str]
    status: str
    created_at: str


class DeleteWebhookResponse(TypedDict):
    object: str
    id: str
    deleted: bool


class WebhookDeliveryListResponse(TypedDict):
    object: str
    data: list[WebhookDeliveryItem]
    has_more: bool


class WebhookDeliveryReplayResponse(TypedDict, total=False):
    object: str
    original_delivery: WebhookDeliveryItem
    replay_delivery: WebhookDeliveryItem


# ---------------------------------------------------------------------------
# Topics
# ---------------------------------------------------------------------------

TopicDefaultSubscription = str  # "opt_in" | "opt_out"
TopicVisibility = str  # "public" | "private"


class CreateTopicPayload(TypedDict, total=False):
    name: str
    description: Optional[str]
    default_subscription: str
    visibility: str


class UpdateTopicPayload(TypedDict, total=False):
    name: str
    description: Optional[str]
    default_subscription: str
    visibility: str


class TopicListOptions(TypedDict, total=False):
    limit: int
    after: str
    search: str


class TopicListItem(TypedDict, total=False):
    id: str
    name: str
    description: Optional[str]
    default_subscription: str
    visibility: str
    created_at: str


class TopicListResponse(TypedDict):
    object: str
    data: list[TopicListItem]
    has_more: bool
    total: Optional[int]


class TopicResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    description: Optional[str]
    default_subscription: str
    visibility: str
    created_at: str


class CreateTopicResponse(TypedDict, total=False):
    object: str
    id: str
    name: str
    description: Optional[str]
    default_subscription: str
    visibility: str
    created_at: str


class DeleteTopicResponse(TypedDict):
    success: bool


# ---------------------------------------------------------------------------
# Suppressions
# ---------------------------------------------------------------------------

SuppressionReason = str  # "bounce" | "complaint" | "manual" | "unsubscribe"


class SuppressionPublicItem(TypedDict, total=False):
    id: str
    object: str
    email: str
    reason: str
    scope: str
    source_event_id: Optional[str]
    source_email_id: Optional[str]
    source_message_id: Optional[str]
    metadata: Optional[JsonObject]
    suppressed_at: str
    updated_at: str


class SuppressionListOptions(TypedDict, total=False):
    limit: int
    after: str


class SuppressionListResponse(TypedDict):
    object: str
    scope: str
    data: list[SuppressionPublicItem]
    has_more: bool


class DeleteSuppressionResponse(TypedDict):
    object: str
    deleted: bool


class CreateSuppressionPayload(TypedDict, total=False):
    email: str
    reason: str


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------


class LogListOptions(TypedDict, total=False):
    limit: int
    after: str
    before: str
    status: str
    method: str
    api_key_id: str
    date_from: str
    date_to: str
    user_agent: str
    search: str


class LogListItem(TypedDict, total=False):
    id: str
    method: Optional[str]
    endpoint: Optional[str]
    response_status: Optional[int]
    user_agent: Optional[str]
    api_key_id: Optional[str]
    created_at: str


class LogListResponse(TypedDict):
    object: str
    data: list[LogListItem]
    has_more: bool


class LogDetailResponse(TypedDict, total=False):
    object: str
    id: str
    method: Optional[str]
    endpoint: Optional[str]
    status: Optional[int]
    user_agent: Optional[str]
    api_key_id: Optional[str]
    request_body: Any
    response_body: Any
    created_at: str
