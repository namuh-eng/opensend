"""Internal HTTP client for OpenSend SDK."""

from __future__ import annotations

import json
from typing import Any, Mapping, Optional, cast
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://opensend.namuh.co"

JsonObject = dict[str, Any]


class OpenSendError(Exception):
    """Raised when OpenSend returns an API error or a request cannot be made."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        name: Optional[str] = None,
        code: Optional[str] = None,
        details: Optional[Mapping[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.name = name
        self.code = code
        self.details = dict(details) if details is not None else None

    def __repr__(self) -> str:
        return (
            f"OpenSendError(message={self.message!r}, status_code={self.status_code!r}, "
            f"name={self.name!r}, code={self.code!r}, details={self.details!r})"
        )


def normalize_base_url(origin: str) -> str:
    if not origin or not origin.strip():
        raise ValueError("base_url must be a non-empty string when provided")

    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("base_url must be a valid absolute http or https URL")

    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", ""))


def decode_json(raw: bytes) -> JsonObject:
    if not raw:
        return {}
    decoded = json.loads(raw.decode("utf-8"))
    if isinstance(decoded, dict):
        return cast(JsonObject, decoded)
    # Some list responses come back as top-level objects; handle gracefully
    raise OpenSendError(
        "Expected a JSON object response from OpenSend",
        status_code=0,
        name="invalid_response",
        code="invalid_response",
    )


def _string(value: object) -> Optional[str]:
    return value if isinstance(value, str) else None


def api_error_from_http_error(error: HTTPError) -> OpenSendError:
    raw = error.read()
    try:
        body: object = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError:
        body = {}

    parsed = body if isinstance(body, dict) else {}
    message = (
        _string(parsed.get("message"))
        or _string(parsed.get("error"))
        or error.reason
    )
    name = _string(parsed.get("name"))
    code = _string(parsed.get("code"))
    details = parsed.get("details") if isinstance(parsed.get("details"), Mapping) else None

    return OpenSendError(
        message,
        status_code=error.code,
        name=name,
        code=code,
        details=cast(Optional[Mapping[str, Any]], details),
    )


class HttpClient:
    """Thin synchronous HTTP client built on urllib (no third-party deps)."""

    _SDK_VERSION = "0.2.0"

    def __init__(self, key: str, origin: str) -> None:
        if not key:
            raise ValueError("API key is required")
        self._api_key = key
        self._base_url = normalize_base_url(origin)

    def request(
        self,
        method: str,
        path: str,
        payload: Any = None,
        *,
        idempotency_key: Optional[str] = None,
        params: Optional[dict[str, str]] = None,
    ) -> JsonObject:
        url = f"{self._base_url}{path}"
        if params:
            from urllib.parse import urlencode
            url = f"{url}?{urlencode(params)}"

        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"opensend-python/{self._SDK_VERSION}",
        }
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key

        request = Request(url, data=body, headers=headers, method=method)

        try:
            with urlopen(request, timeout=30) as response:  # noqa: S310
                raw = response.read()
                if not raw:
                    return {}
                decoded = json.loads(raw.decode("utf-8"))
                if isinstance(decoded, dict):
                    return cast(JsonObject, decoded)
                # Wrap bare lists (not used in current API, but defensive)
                return cast(JsonObject, {"data": decoded})
        except HTTPError as error:
            raise api_error_from_http_error(error) from None
        except URLError as error:
            raise OpenSendError(
                str(error.reason),
                status_code=0,
                name="request_error",
                code="request_error",
            ) from error
