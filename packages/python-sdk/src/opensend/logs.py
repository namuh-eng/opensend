"""Logs resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    LogDetailResponse,
    LogListOptions,
    LogListResponse,
)


class LogsResource:
    """Read-only access to API request logs via /api/logs."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def list(self, options: Optional[LogListOptions] = None) -> LogListResponse:
        """List API request logs with optional filters and pagination."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if opts.get("before"):
            query["before"] = opts["before"]  # type: ignore[assignment]
        if opts.get("status"):
            query["status"] = opts["status"]  # type: ignore[assignment]
        if opts.get("method"):
            query["method"] = opts["method"]  # type: ignore[assignment]
        if opts.get("api_key_id"):
            query["api_key_id"] = opts["api_key_id"]  # type: ignore[assignment]
        if opts.get("date_from"):
            query["date_from"] = opts["date_from"]  # type: ignore[assignment]
        if opts.get("date_to"):
            query["date_to"] = opts["date_to"]  # type: ignore[assignment]
        if opts.get("user_agent"):
            query["user_agent"] = opts["user_agent"]  # type: ignore[assignment]
        if opts.get("search"):
            query["search"] = opts["search"]  # type: ignore[assignment]
        return cast(
            LogListResponse,
            self._client.request("GET", "/api/logs", params=query or None),
        )

    def get(self, log_id: str) -> LogDetailResponse:
        """Retrieve a single log entry by ID."""
        return cast(
            LogDetailResponse,
            self._client.request("GET", f"/api/logs/{log_id}"),
        )
