"""Domains resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    CreateDomainPayload,
    DeleteDomainResponse,
    DomainListResponse,
    DomainResponse,
    UpdateDomainPayload,
)


class DomainsResource:
    """CRUD + verify operations for the /api/domains namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateDomainPayload) -> DomainResponse:
        """Create and verify a new sending domain."""
        return cast(DomainResponse, self._client.request("POST", "/api/domains", payload))

    def list(self) -> DomainListResponse:
        """List all sending domains."""
        return cast(DomainListResponse, self._client.request("GET", "/api/domains"))

    def get(self, domain_id: str) -> DomainResponse:
        """Retrieve a single domain by ID."""
        return cast(DomainResponse, self._client.request("GET", f"/api/domains/{domain_id}"))

    def update(self, domain_id: str, payload: UpdateDomainPayload) -> DomainResponse:
        """Update tracking settings for a domain."""
        return cast(
            DomainResponse,
            self._client.request("PATCH", f"/api/domains/{domain_id}", payload),
        )

    def verify(self, domain_id: str) -> DomainResponse:
        """Trigger re-verification of DNS records for a domain."""
        return cast(
            DomainResponse,
            self._client.request("POST", f"/api/domains/{domain_id}/verify"),
        )

    def delete(self, domain_id: str) -> DeleteDomainResponse:
        """Delete a domain."""
        return cast(
            DeleteDomainResponse,
            self._client.request("DELETE", f"/api/domains/{domain_id}"),
        )
