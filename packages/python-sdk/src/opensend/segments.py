"""Segments resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    CreateSegmentPayload,
    DeleteSegmentResponse,
    ListOptions,
    SegmentContactListResponse,
    SegmentListOptions,
    SegmentListResponse,
    SegmentResponse,
)


class SegmentsResource:
    """CRUD + contacts-within-segment for the /segments namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateSegmentPayload) -> SegmentResponse:
        """Create a new contact segment."""
        return cast(SegmentResponse, self._client.request("POST", "/segments", payload))

    def list(self, options: Optional[SegmentListOptions] = None) -> SegmentListResponse:
        """List segments with optional pagination and search."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if opts.get("search"):
            query["search"] = opts["search"]  # type: ignore[assignment]
        return cast(
            SegmentListResponse,
            self._client.request("GET", "/segments", params=query or None),
        )

    def get(self, segment_id: str) -> SegmentResponse:
        """Retrieve a segment by ID."""
        return cast(SegmentResponse, self._client.request("GET", f"/segments/{segment_id}"))

    def delete(self, segment_id: str) -> DeleteSegmentResponse:
        """Delete a segment by ID."""
        return cast(
            DeleteSegmentResponse,
            self._client.request("DELETE", f"/segments/{segment_id}"),
        )

    def list_contacts(
        self, segment_id: str, options: Optional[ListOptions] = None
    ) -> SegmentContactListResponse:
        """List contacts that belong to a given segment."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        return cast(
            SegmentContactListResponse,
            self._client.request(
                "GET", f"/segments/{segment_id}/contacts", params=query or None
            ),
        )
