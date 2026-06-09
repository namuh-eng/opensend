"""OpenSend Python SDK — full surface parity with the TypeScript SDK.

Quick start (instance API — recommended)::

    import opensend

    client = opensend.OpenSend("os_...")
    result = client.emails.send({"from": "you@example.com", "to": "them@example.com",
                                  "subject": "Hi", "html": "<p>Hi</p>"})

Module-level API (backwards-compatible shorthand)::

    import opensend
    opensend.api_key = "os_..."
    opensend.Emails.send({"from": "you@example.com", ...})
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence, cast

from ._http import DEFAULT_BASE_URL, HttpClient, OpenSendError, normalize_base_url
from ._types import (
    # Emails
    BatchEmailResponse,
    CancelEmailResponse,
    EmailAttachment,
    EmailDetailResponse,
    EmailListItem,
    EmailListOptions,
    EmailListResponse,
    EmailResponse,
    EmailTag,
    EmailTemplateReference,
    SendParams,
    # Domains
    CreateDomainPayload,
    DeleteDomainResponse,
    DomainListItem,
    DomainListResponse,
    DomainRecord,
    DomainResponse,
    UpdateDomainPayload,
    # API Keys
    ApiKeyListItem,
    ApiKeyListResponse,
    ApiKeyResponse,
    CreateApiKeyPayload,
    # Contacts
    ContactListItem,
    ContactListResponse,
    ContactResponse,
    ContactTopicPreference,
    CreateContactPayload,
    CreateContactResponse,
    DeleteContactResponse,
    UpdateContactPayload,
    # Segments
    CreateSegmentPayload,
    DeleteSegmentResponse,
    SegmentContactListItem,
    SegmentContactListResponse,
    SegmentListItem,
    SegmentListOptions,
    SegmentListResponse,
    SegmentResponse,
    # Audiences
    AudienceListItem,
    AudienceListOptions,
    AudienceListResponse,
    AudienceResponse,
    CreateAudiencePayload,
    DeleteAudienceResponse,
    # Broadcasts
    BroadcastListItem,
    BroadcastListOptions,
    BroadcastListResponse,
    BroadcastResponse,
    BroadcastStatus,
    CreateBroadcastPayload,
    CreateBroadcastResponse,
    DeleteBroadcastResponse,
    SendBroadcastPayload,
    SendBroadcastResponse,
    UpdateBroadcastPayload,
    # Templates
    CreateTemplatePayload,
    CreateTemplateResponse,
    DeleteTemplateResponse,
    DuplicateTemplateResponse,
    PublishTemplateResponse,
    TemplateListItem,
    TemplateListOptions,
    TemplateListResponse,
    TemplateResponse,
    TemplateStatus,
    TemplateVariable,
    UpdateTemplatePayload,
    UpdateTemplateResponse,
    # Automations
    AutomationDeleteResponse,
    AutomationDetailResponse,
    AutomationListItem,
    AutomationListResponse,
    AutomationRunDetailItem,
    AutomationRunListItem,
    AutomationRunListOptions,
    AutomationRunListResponse,
    AutomationRunMetricsOptions,
    AutomationRunMetricsResponse,
    AutomationRunStepState,
    AutomationStatus,
    AutomationStepPayload,
    AutomationStepResponse,
    CancelAutomationRunPayload,
    CreateAutomationPayload,
    # Events
    CreateEventPayload,
    CustomEvent,
    CustomEventDelivery,
    CustomEventListResponse,
    ListOptions,
    SendCustomEventResponse,
    SendEventPayload,
    # Webhooks
    CreateWebhookPayload,
    DeleteWebhookResponse,
    UpdateWebhookPayload,
    WebhookCreateResponse,
    WebhookDeliveryItem,
    WebhookDeliveryListResponse,
    WebhookDeliveryReplayResponse,
    WebhookDetailResponse,
    WebhookListItem,
    WebhookListResponse,
    WebhookResponse,
    WebhookStatus,
    WebhookUpdateResponse,
    # Topics
    CreateTopicPayload,
    CreateTopicResponse,
    DeleteTopicResponse,
    TopicDefaultSubscription,
    TopicListItem,
    TopicListOptions,
    TopicListResponse,
    TopicResponse,
    TopicVisibility,
    UpdateTopicPayload,
    # Suppressions
    CreateSuppressionPayload,
    DeleteSuppressionResponse,
    SuppressionListOptions,
    SuppressionListResponse,
    SuppressionPublicItem,
    SuppressionReason,
    # Logs
    LogDetailResponse,
    LogListItem,
    LogListOptions,
    LogListResponse,
)
from .emails import EmailsResource
from .domains import DomainsResource
from .api_keys import ApiKeysResource
from .contacts import ContactsResource
from .segments import SegmentsResource
from .audiences import AudiencesResource
from .broadcasts import BroadcastsResource
from .templates import TemplatesResource
from .automations import AutomationsResource
from .events import EventsResource
from .webhooks import WebhooksResource
from .topics import TopicsResource
from .suppressions import SuppressionsResource
from .logs import LogsResource

# ---------------------------------------------------------------------------
# Module-level state (backwards-compatible shorthand API)
# ---------------------------------------------------------------------------

api_key: Optional[str] = None
base_url: str = DEFAULT_BASE_URL


@dataclass(frozen=True)
class RequestOptions:
    idempotency_key: Optional[str] = None


# ---------------------------------------------------------------------------
# Instance client
# ---------------------------------------------------------------------------


class OpenSend:
    """Full OpenSend API client.

    Usage::

        client = OpenSend("os_your_api_key")
        client.emails.send({"from": "...", "to": "...", "subject": "...", "html": "..."})
    """

    def __init__(self, api_key: str, *, base_url: str = DEFAULT_BASE_URL) -> None:
        http = HttpClient(api_key, base_url)

        self.emails: EmailsResource = EmailsResource(http)
        self.domains: DomainsResource = DomainsResource(http)
        self.api_keys: ApiKeysResource = ApiKeysResource(http)
        self.contacts: ContactsResource = ContactsResource(http)
        self.segments: SegmentsResource = SegmentsResource(http)
        self.audiences: AudiencesResource = AudiencesResource(http)
        self.broadcasts: BroadcastsResource = BroadcastsResource(http)
        self.templates: TemplatesResource = TemplatesResource(http)
        self.automations: AutomationsResource = AutomationsResource(http)
        self.events: EventsResource = EventsResource(http)
        self.webhooks: WebhooksResource = WebhooksResource(http)
        self.topics: TopicsResource = TopicsResource(http)
        self.suppressions: SuppressionsResource = SuppressionsResource(http)
        self.logs: LogsResource = LogsResource(http)


class Resend(OpenSend):
    """Alias of :class:`OpenSend` for code migrating from Resend to OpenSend."""


# ---------------------------------------------------------------------------
# Module-level convenience helpers
# ---------------------------------------------------------------------------


def _resolve_client(
    *, api_key: Optional[str], base_url: Optional[str]
) -> HttpClient:
    key = api_key if api_key is not None else globals()["api_key"]
    if key is None:
        raise ValueError(
            "API key is required; set opensend.api_key or pass api_key=..."
        )
    origin = base_url if base_url is not None else globals()["base_url"]
    return HttpClient(key, origin)


class Emails:
    """Module-level email resource using the global ``opensend.api_key``."""

    SendParams = SendParams
    EmailResponse = EmailResponse
    BatchEmailResponse = BatchEmailResponse

    @staticmethod
    def send(
        params: SendParams,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> EmailResponse:
        http = _resolve_client(api_key=api_key, base_url=base_url)
        return EmailsResource(http).send(params, idempotency_key=idempotency_key)

    @staticmethod
    def send_batch(
        params: Sequence[SendParams],
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> BatchEmailResponse:
        http = _resolve_client(api_key=api_key, base_url=base_url)
        return EmailsResource(http).send_batch(params, idempotency_key=idempotency_key)

    @staticmethod
    def list(
        options: Optional[EmailListOptions] = None,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> EmailListResponse:
        http = _resolve_client(api_key=api_key, base_url=base_url)
        return EmailsResource(http).list(options)

    @staticmethod
    def get(
        email_id: str,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> EmailDetailResponse:
        http = _resolve_client(api_key=api_key, base_url=base_url)
        return EmailsResource(http).get(email_id)

    @staticmethod
    def cancel(
        email_id: str,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> CancelEmailResponse:
        http = _resolve_client(api_key=api_key, base_url=base_url)
        return EmailsResource(http).cancel(email_id)


# Alias ApiError → OpenSendError for backwards compat
ApiError = OpenSendError

# ---------------------------------------------------------------------------
# __all__
# ---------------------------------------------------------------------------

__all__ = [
    # Core classes
    "OpenSend",
    "Resend",
    "OpenSendError",
    "ApiError",
    "RequestOptions",
    "DEFAULT_BASE_URL",
    # Module-level state
    "api_key",
    "base_url",
    # Module-level convenience
    "Emails",
    # Resource classes (for type hints / subclassing)
    "EmailsResource",
    "DomainsResource",
    "ApiKeysResource",
    "ContactsResource",
    "SegmentsResource",
    "AudiencesResource",
    "BroadcastsResource",
    "TemplatesResource",
    "AutomationsResource",
    "EventsResource",
    "WebhooksResource",
    "TopicsResource",
    "SuppressionsResource",
    "LogsResource",
    # Email types
    "SendParams",
    "EmailResponse",
    "BatchEmailResponse",
    "EmailAttachment",
    "EmailTag",
    "EmailTemplateReference",
    "EmailListOptions",
    "EmailListItem",
    "EmailListResponse",
    "EmailDetailResponse",
    "CancelEmailResponse",
    # Domain types
    "CreateDomainPayload",
    "DomainRecord",
    "DomainResponse",
    "DomainListItem",
    "DomainListResponse",
    "UpdateDomainPayload",
    "DeleteDomainResponse",
    # API key types
    "CreateApiKeyPayload",
    "ApiKeyResponse",
    "ApiKeyListItem",
    "ApiKeyListResponse",
    # Contact types
    "CreateContactPayload",
    "CreateContactResponse",
    "ContactResponse",
    "ContactListItem",
    "ContactListResponse",
    "UpdateContactPayload",
    "DeleteContactResponse",
    "ContactTopicPreference",
    # Segment types
    "CreateSegmentPayload",
    "SegmentResponse",
    "SegmentListItem",
    "SegmentListOptions",
    "SegmentListResponse",
    "DeleteSegmentResponse",
    "SegmentContactListItem",
    "SegmentContactListResponse",
    # Audience types
    "CreateAudiencePayload",
    "AudienceResponse",
    "AudienceListItem",
    "AudienceListOptions",
    "AudienceListResponse",
    "DeleteAudienceResponse",
    # Broadcast types
    "BroadcastStatus",
    "CreateBroadcastPayload",
    "UpdateBroadcastPayload",
    "SendBroadcastPayload",
    "BroadcastListOptions",
    "BroadcastListItem",
    "BroadcastListResponse",
    "BroadcastResponse",
    "CreateBroadcastResponse",
    "DeleteBroadcastResponse",
    "SendBroadcastResponse",
    # Template types
    "TemplateStatus",
    "TemplateVariable",
    "CreateTemplatePayload",
    "UpdateTemplatePayload",
    "TemplateListOptions",
    "TemplateListItem",
    "TemplateListResponse",
    "TemplateResponse",
    "CreateTemplateResponse",
    "UpdateTemplateResponse",
    "DeleteTemplateResponse",
    "PublishTemplateResponse",
    "DuplicateTemplateResponse",
    # Automation types
    "AutomationStatus",
    "AutomationStepPayload",
    "AutomationStepResponse",
    "CreateAutomationPayload",
    "AutomationDetailResponse",
    "AutomationListItem",
    "AutomationListResponse",
    "AutomationDeleteResponse",
    "AutomationRunStepState",
    "AutomationRunListItem",
    "AutomationRunDetailItem",
    "AutomationRunListResponse",
    "AutomationRunListOptions",
    "CancelAutomationRunPayload",
    "AutomationRunMetricsOptions",
    "AutomationRunMetricsResponse",
    # Event types
    "CreateEventPayload",
    "CustomEvent",
    "CustomEventListResponse",
    "CustomEventDelivery",
    "SendCustomEventResponse",
    "SendEventPayload",
    "ListOptions",
    # Webhook types
    "WebhookStatus",
    "CreateWebhookPayload",
    "UpdateWebhookPayload",
    "WebhookDeliveryItem",
    "WebhookListItem",
    "WebhookListResponse",
    "WebhookResponse",
    "WebhookCreateResponse",
    "WebhookDetailResponse",
    "WebhookUpdateResponse",
    "DeleteWebhookResponse",
    "WebhookDeliveryListResponse",
    "WebhookDeliveryReplayResponse",
    # Topic types
    "TopicDefaultSubscription",
    "TopicVisibility",
    "CreateTopicPayload",
    "UpdateTopicPayload",
    "TopicListOptions",
    "TopicListItem",
    "TopicListResponse",
    "TopicResponse",
    "CreateTopicResponse",
    "DeleteTopicResponse",
    # Suppression types
    "SuppressionReason",
    "SuppressionPublicItem",
    "SuppressionListOptions",
    "SuppressionListResponse",
    "DeleteSuppressionResponse",
    "CreateSuppressionPayload",
    # Log types
    "LogListOptions",
    "LogListItem",
    "LogListResponse",
    "LogDetailResponse",
]
