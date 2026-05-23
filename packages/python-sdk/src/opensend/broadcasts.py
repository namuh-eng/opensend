"""Broadcasts resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Any, Mapping, Optional, cast

from ._http import HttpClient, JsonObject
from ._types import (
    BroadcastListOptions,
    BroadcastListResponse,
    BroadcastResponse,
    CreateBroadcastPayload,
    CreateBroadcastResponse,
    DeleteBroadcastResponse,
    SendBroadcastPayload,
    SendBroadcastResponse,
    UpdateBroadcastPayload,
)


def _normalize_broadcast_payload(payload: Mapping[str, Any]) -> JsonObject:
    """Resolve camelCase aliases into snake_case for the API."""
    result = dict(payload)
    # "from" is a Python keyword, so callers may pass "from_" or keep it in the dict
    from_ = result.pop("from_", None)
    if "from" not in result and from_ is not None:
        result["from"] = from_
    return result


class BroadcastsResource:
    """CRUD + send operations for the /broadcasts namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(
        self,
        payload: CreateBroadcastPayload,
        *,
        idempotency_key: Optional[str] = None,
    ) -> CreateBroadcastResponse:
        """Create a broadcast (bulk email campaign)."""
        return cast(
            CreateBroadcastResponse,
            self._client.request(
                "POST",
                "/broadcasts",
                _normalize_broadcast_payload(payload),
                idempotency_key=idempotency_key,
            ),
        )

    def list(self, options: Optional[BroadcastListOptions] = None) -> BroadcastListResponse:
        """List broadcasts with optional filters and pagination."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if opts.get("search"):
            query["search"] = opts["search"]  # type: ignore[assignment]
        if opts.get("status"):
            query["status"] = opts["status"]  # type: ignore[assignment]
        if opts.get("segment_id"):
            query["segmentId"] = opts["segment_id"]  # type: ignore[assignment]
        return cast(
            BroadcastListResponse,
            self._client.request("GET", "/broadcasts", params=query or None),
        )

    def get(self, broadcast_id: str) -> BroadcastResponse:
        """Retrieve a broadcast by ID."""
        return cast(
            BroadcastResponse,
            self._client.request("GET", f"/broadcasts/{broadcast_id}"),
        )

    def update(self, broadcast_id: str, payload: UpdateBroadcastPayload) -> BroadcastResponse:
        """Update a broadcast's content or schedule."""
        return cast(
            BroadcastResponse,
            self._client.request(
                "PATCH",
                f"/broadcasts/{broadcast_id}",
                _normalize_broadcast_payload(payload),
            ),
        )

    def delete(self, broadcast_id: str) -> DeleteBroadcastResponse:
        """Delete a broadcast by ID."""
        return cast(
            DeleteBroadcastResponse,
            self._client.request("DELETE", f"/broadcasts/{broadcast_id}"),
        )

    def send(
        self,
        broadcast_id: str,
        payload: Optional[SendBroadcastPayload] = None,
        *,
        idempotency_key: Optional[str] = None,
    ) -> SendBroadcastResponse:
        """Send or schedule a broadcast for delivery."""
        body = _normalize_broadcast_payload(payload) if payload else {}
        return cast(
            SendBroadcastResponse,
            self._client.request(
                "POST",
                f"/broadcasts/{broadcast_id}/send",
                body,
                idempotency_key=idempotency_key,
            ),
        )
