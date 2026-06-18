"""Topics resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    CreateTopicPayload,
    CreateTopicResponse,
    DeleteTopicResponse,
    TopicListOptions,
    TopicListResponse,
    TopicResponse,
    UpdateTopicPayload,
)


class TopicsResource:
    """CRUD operations for the /api/topics namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateTopicPayload) -> CreateTopicResponse:
        """Create a new subscription topic."""
        return cast(CreateTopicResponse, self._client.request("POST", "/api/topics", payload))

    def list(self, options: Optional[TopicListOptions] = None) -> TopicListResponse:
        """List subscription topics with optional search and pagination."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if opts.get("search"):
            query["search"] = opts["search"]  # type: ignore[assignment]
        return cast(
            TopicListResponse,
            self._client.request("GET", "/api/topics", params=query or None),
        )

    def get(self, topic_id: str) -> TopicResponse:
        """Retrieve a topic by ID."""
        return cast(TopicResponse, self._client.request("GET", f"/api/topics/{topic_id}"))

    def update(self, topic_id: str, payload: UpdateTopicPayload) -> TopicResponse:
        """Update a topic's name, description, or subscription defaults."""
        return cast(
            TopicResponse,
            self._client.request("PATCH", f"/api/topics/{topic_id}", payload),
        )

    def delete(self, topic_id: str) -> DeleteTopicResponse:
        """Delete a topic by ID."""
        return cast(
            DeleteTopicResponse,
            self._client.request("DELETE", f"/api/topics/{topic_id}"),
        )
