"""Suppressions resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast
from urllib.parse import quote

from ._http import HttpClient
from ._types import (
    CreateSuppressionPayload,
    DeleteSuppressionResponse,
    SuppressionListOptions,
    SuppressionListResponse,
    SuppressionPublicItem,
)


class SuppressionsResource:
    """Manage the email suppression list via /api/suppressions."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def list(
        self, options: Optional[SuppressionListOptions] = None
    ) -> SuppressionListResponse:
        """List all suppressed email addresses."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        return cast(
            SuppressionListResponse,
            self._client.request("GET", "/api/suppressions", params=query or None),
        )

    def get(self, email: str) -> SuppressionPublicItem:
        """Retrieve a suppression entry by email address."""
        return cast(
            SuppressionPublicItem,
            self._client.request("GET", f"/api/suppressions/{quote(email, safe='')}"),
        )

    def create(
        self,
        payload: CreateSuppressionPayload,
        *,
        idempotency_key: Optional[str] = None,
    ) -> SuppressionPublicItem:
        """Manually add an email address to the suppression list."""
        return cast(
            SuppressionPublicItem,
            self._client.request(
                "POST", "/api/suppressions", payload, idempotency_key=idempotency_key
            ),
        )

    def delete(self, email: str) -> DeleteSuppressionResponse:
        """Remove an email address from the suppression list."""
        return cast(
            DeleteSuppressionResponse,
            self._client.request(
                "DELETE", f"/api/suppressions/{quote(email, safe='')}"
            ),
        )
