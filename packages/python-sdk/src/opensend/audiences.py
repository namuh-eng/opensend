"""Audiences resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    AudienceListOptions,
    AudienceListResponse,
    AudienceResponse,
    CreateAudiencePayload,
    DeleteAudienceResponse,
)


class AudiencesResource:
    """CRUD operations for the /audiences namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateAudiencePayload) -> AudienceResponse:
        """Create a new audience."""
        return cast(AudienceResponse, self._client.request("POST", "/audiences", payload))

    def list(self, options: Optional[AudienceListOptions] = None) -> AudienceListResponse:
        """List audiences with optional pagination and search."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if opts.get("search"):
            query["search"] = opts["search"]  # type: ignore[assignment]
        return cast(
            AudienceListResponse,
            self._client.request("GET", "/audiences", params=query or None),
        )

    def get(self, audience_id: str) -> AudienceResponse:
        """Retrieve an audience by ID."""
        return cast(AudienceResponse, self._client.request("GET", f"/audiences/{audience_id}"))

    def delete(self, audience_id: str) -> DeleteAudienceResponse:
        """Delete an audience by ID."""
        return cast(
            DeleteAudienceResponse,
            self._client.request("DELETE", f"/audiences/{audience_id}"),
        )
