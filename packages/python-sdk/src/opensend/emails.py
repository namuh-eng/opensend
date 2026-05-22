"""Emails resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, cast

from ._http import HttpClient, JsonObject
from ._types import (
    BatchEmailResponse,
    CancelEmailResponse,
    EmailDetailResponse,
    EmailListOptions,
    EmailListResponse,
    EmailResponse,
    SendParams,
)


def _normalize_send_params(params: SendParams) -> JsonObject:
    """Resolve from_ / from_email aliases into the canonical 'from' key."""
    payload = dict(cast(Mapping[str, Any], params))

    from_email = payload.pop("from_email", None)
    from_ = payload.pop("from_", None)
    if "from" not in payload:
        if from_email is not None:
            payload["from"] = from_email
        elif from_ is not None:
            payload["from"] = from_

    return payload


class EmailsResource:
    """CRUD + send operations for the /emails namespace."""

    SendParams = SendParams
    EmailResponse = EmailResponse
    BatchEmailResponse = BatchEmailResponse

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def send(
        self,
        params: SendParams,
        *,
        idempotency_key: Optional[str] = None,
    ) -> EmailResponse:
        """Send a single transactional email."""
        payload = _normalize_send_params(params)
        return cast(
            EmailResponse,
            self._client.request("POST", "/emails", payload, idempotency_key=idempotency_key),
        )

    def send_batch(
        self,
        params: Sequence[SendParams],
        *,
        idempotency_key: Optional[str] = None,
    ) -> BatchEmailResponse:
        """Send multiple emails in a single API call."""
        payload = [_normalize_send_params(item) for item in params]
        return cast(
            BatchEmailResponse,
            self._client.request("POST", "/emails/batch", payload, idempotency_key=idempotency_key),
        )

    def list(self, options: Optional[EmailListOptions] = None) -> EmailListResponse:
        """List sent emails with optional pagination and filters."""
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

        return cast(
            EmailListResponse,
            self._client.request("GET", "/api/emails", params=query or None),
        )

    def get(self, email_id: str) -> EmailDetailResponse:
        """Retrieve a single email by ID."""
        return cast(
            EmailDetailResponse,
            self._client.request("GET", f"/api/emails/{email_id}"),
        )

    def cancel(self, email_id: str) -> CancelEmailResponse:
        """Cancel a scheduled email by ID."""
        return cast(
            CancelEmailResponse,
            self._client.request("POST", f"/emails/{email_id}/cancel"),
        )
