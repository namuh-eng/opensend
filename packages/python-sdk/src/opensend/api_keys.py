"""API Keys resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import cast

from ._http import HttpClient, JsonObject
from ._types import ApiKeyListResponse, ApiKeyResponse, CreateApiKeyPayload


class ApiKeysResource:
    """Create, list, and delete API keys via the /api-keys namespace."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateApiKeyPayload) -> ApiKeyResponse:
        """Create a new API key."""
        return cast(ApiKeyResponse, self._client.request("POST", "/api-keys", payload))

    def list(self) -> ApiKeyListResponse:
        """List all API keys for the authenticated user."""
        return cast(ApiKeyListResponse, self._client.request("GET", "/api-keys"))

    def delete(self, key_id: str) -> JsonObject:
        """Delete an API key by ID. Returns an empty object on success."""
        return self._client.request("DELETE", f"/api-keys/{key_id}")
