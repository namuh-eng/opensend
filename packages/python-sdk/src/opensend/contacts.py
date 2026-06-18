"""Contacts resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Optional, cast

from ._http import HttpClient
from ._types import (
    ContactListResponse,
    ContactResponse,
    CreateContactPayload,
    CreateContactResponse,
    DeleteContactResponse,
    ListOptions,
    UpdateContactPayload,
)


class ContactsResource:
    """CRUD operations for the /contacts namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateContactPayload) -> CreateContactResponse:
        """Create a new contact."""
        return cast(CreateContactResponse, self._client.request("POST", "/contacts", payload))

    def list(self, options: Optional[ListOptions] = None) -> ContactListResponse:
        """List contacts with optional pagination."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        return cast(
            ContactListResponse,
            self._client.request("GET", "/contacts", params=query or None),
        )

    def get(self, contact_id: str) -> ContactResponse:
        """Retrieve a single contact by ID."""
        return cast(ContactResponse, self._client.request("GET", f"/contacts/{contact_id}"))

    def update(self, contact_id: str, payload: UpdateContactPayload) -> ContactResponse:
        """Update a contact's details."""
        return cast(
            ContactResponse,
            self._client.request("PATCH", f"/contacts/{contact_id}", payload),
        )

    def delete(self, contact_id: str) -> DeleteContactResponse:
        """Delete a contact by ID."""
        return cast(
            DeleteContactResponse,
            self._client.request("DELETE", f"/contacts/{contact_id}"),
        )
