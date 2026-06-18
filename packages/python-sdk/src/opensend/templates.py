"""Templates resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Any, Mapping, Optional, cast

from ._http import HttpClient, JsonObject
from ._types import (
    CreateTemplatePayload,
    CreateTemplateResponse,
    DeleteTemplateResponse,
    DuplicateTemplateResponse,
    PublishTemplateResponse,
    TemplateListOptions,
    TemplateListResponse,
    TemplateResponse,
    UpdateTemplatePayload,
    UpdateTemplateResponse,
)


def _normalize_template_payload(payload: Mapping[str, Any]) -> JsonObject:
    """Resolve from_email → from for the API."""
    result = dict(payload)
    from_email = result.pop("from_email", None)
    if "from" not in result and from_email is not None:
        result["from"] = from_email
    return result


class TemplatesResource:
    """CRUD + publish/duplicate for the /templates namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateTemplatePayload) -> CreateTemplateResponse:
        """Create a new email template."""
        return cast(
            CreateTemplateResponse,
            self._client.request("POST", "/templates", _normalize_template_payload(payload)),
        )

    def list(self, options: Optional[TemplateListOptions] = None) -> TemplateListResponse:
        """List templates with optional filters and pagination."""
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
        return cast(
            TemplateListResponse,
            self._client.request("GET", "/templates", params=query or None),
        )

    def get(self, id_or_alias: str) -> TemplateResponse:
        """Retrieve a template by ID or alias."""
        return cast(
            TemplateResponse,
            self._client.request("GET", f"/templates/{id_or_alias}"),
        )

    def update(
        self, id_or_alias: str, payload: UpdateTemplatePayload
    ) -> UpdateTemplateResponse:
        """Update a template's content or metadata."""
        return cast(
            UpdateTemplateResponse,
            self._client.request(
                "PATCH",
                f"/templates/{id_or_alias}",
                _normalize_template_payload(payload),
            ),
        )

    def delete(self, id_or_alias: str) -> DeleteTemplateResponse:
        """Delete a template by ID or alias."""
        return cast(
            DeleteTemplateResponse,
            self._client.request("DELETE", f"/templates/{id_or_alias}"),
        )

    def publish(self, id_or_alias: str) -> PublishTemplateResponse:
        """Publish the current draft version of a template."""
        return cast(
            PublishTemplateResponse,
            self._client.request("POST", f"/templates/{id_or_alias}/publish"),
        )

    def duplicate(self, id_or_alias: str) -> DuplicateTemplateResponse:
        """Duplicate a template."""
        return cast(
            DuplicateTemplateResponse,
            self._client.request("POST", f"/templates/{id_or_alias}/duplicate"),
        )
