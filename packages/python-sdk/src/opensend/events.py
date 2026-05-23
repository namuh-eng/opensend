"""Events resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    CreateEventPayload,
    CustomEvent,
    CustomEventListResponse,
    ListOptions,
    SendCustomEventResponse,
    SendEventPayload,
)


class EventsResource:
    """Create custom event schemas and send event deliveries (/api/events)."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateEventPayload) -> CustomEvent:
        """Define a new custom event schema."""
        return cast(CustomEvent, self._client.request("POST", "/api/events", payload))

    def list(self, options: Optional[ListOptions] = None) -> CustomEventListResponse:
        """List all custom event definitions."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        return cast(
            CustomEventListResponse,
            self._client.request("GET", "/api/events", params=query or None),
        )

    def send(self, payload: SendEventPayload) -> SendCustomEventResponse:
        """Send (fire) a custom event, resuming any matching automation runs."""
        return cast(
            SendCustomEventResponse,
            self._client.request("POST", "/api/events/send", payload),
        )
