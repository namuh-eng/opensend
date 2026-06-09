"""Webhooks resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    CreateWebhookPayload,
    DeleteWebhookResponse,
    ListOptions,
    UpdateWebhookPayload,
    WebhookCreateResponse,
    WebhookDeliveryListResponse,
    WebhookDeliveryReplayResponse,
    WebhookDetailResponse,
    WebhookListResponse,
    WebhookUpdateResponse,
)


class WebhooksResource:
    """CRUD + delivery management for the /api/webhooks namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(
        self,
        payload: CreateWebhookPayload,
        *,
        idempotency_key: Optional[str] = None,
    ) -> WebhookCreateResponse:
        """Register a new webhook endpoint."""
        return cast(
            WebhookCreateResponse,
            self._client.request(
                "POST", "/api/webhooks", payload, idempotency_key=idempotency_key
            ),
        )

    def list(self, options: Optional[ListOptions] = None) -> WebhookListResponse:
        """List all registered webhooks."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        return cast(
            WebhookListResponse,
            self._client.request("GET", "/api/webhooks", params=query or None),
        )

    def get(self, webhook_id: str) -> WebhookDetailResponse:
        """Retrieve a webhook with its recent delivery history."""
        return cast(
            WebhookDetailResponse,
            self._client.request("GET", f"/api/webhooks/{webhook_id}"),
        )

    def update(
        self, webhook_id: str, payload: UpdateWebhookPayload
    ) -> WebhookUpdateResponse:
        """Update a webhook's endpoint URL, events, or status."""
        return cast(
            WebhookUpdateResponse,
            self._client.request("PATCH", f"/api/webhooks/{webhook_id}", payload),
        )

    def delete(self, webhook_id: str) -> DeleteWebhookResponse:
        """Delete a webhook by ID."""
        return cast(
            DeleteWebhookResponse,
            self._client.request("DELETE", f"/api/webhooks/{webhook_id}"),
        )

    def list_deliveries(
        self, webhook_id: str, options: Optional[ListOptions] = None
    ) -> WebhookDeliveryListResponse:
        """List delivery attempts for a webhook."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        return cast(
            WebhookDeliveryListResponse,
            self._client.request(
                "GET",
                f"/api/webhooks/{webhook_id}/deliveries",
                params=query or None,
            ),
        )

    def replay_delivery(
        self, webhook_id: str, delivery_id: str
    ) -> WebhookDeliveryReplayResponse:
        """Replay a past webhook delivery attempt."""
        return cast(
            WebhookDeliveryReplayResponse,
            self._client.request(
                "POST",
                f"/api/webhooks/{webhook_id}/deliveries/{delivery_id}/replay",
            ),
        )
