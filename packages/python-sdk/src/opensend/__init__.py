"""Minimal OpenSend Python SDK for transactional email sends."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence, TypedDict, Union, cast
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://opensend.namuh.co"

api_key: Optional[str] = None
base_url: str = DEFAULT_BASE_URL

JsonObject = dict[str, Any]
EmailAddress = Union[str, Sequence[str]]


class EmailAttachment(TypedDict, total=False):
    filename: str
    content: str
    path: str
    content_type: str
    content_id: str


class EmailTag(TypedDict):
    name: str
    value: str


class EmailTemplateReference(TypedDict, total=False):
    id: str
    variables: Mapping[str, Any]


SendParams = TypedDict(
    "SendParams",
    {
        "from": str,
        "from_": str,
        "from_email": str,
        "to": EmailAddress,
        "subject": str,
        "html": str,
        "text": str,
        "cc": EmailAddress,
        "bcc": EmailAddress,
        "reply_to": EmailAddress,
        "headers": Mapping[str, str],
        "attachments": Sequence[EmailAttachment],
        "tags": Sequence[EmailTag],
        "scheduled_at": str,
        "topic_id": str,
        "template": EmailTemplateReference,
    },
    total=False,
)


class EmailResponse(TypedDict):
    id: str


class BatchEmailResponse(TypedDict):
    data: list[EmailResponse]


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


@dataclass(frozen=True)
class RequestOptions:
    idempotency_key: Optional[str] = None


class _HttpClient:
    def __init__(self, key: str, origin: str) -> None:
        if not key:
            raise ValueError("API key is required")
        self._api_key = key
        self._base_url = _normalize_base_url(origin)

    def request(
        self,
        method: str,
        path: str,
        payload: Any = None,
        *,
        idempotency_key: Optional[str] = None,
    ) -> JsonObject:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "opensend-python/0.1.0",
        }
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key

        request = Request(
            f"{self._base_url}{path}",
            data=body,
            headers=headers,
            method=method,
        )

        try:
            with urlopen(request, timeout=30) as response:  # noqa: S310 - SDK caller controls base_url.
                return _decode_json(response.read())
        except HTTPError as error:
            raise _api_error_from_http_error(error) from None
        except URLError as error:
            raise OpenSendError(
                str(error.reason),
                status_code=0,
                name="request_error",
                code="request_error",
            ) from error


class _EmailsResource:
    SendParams = SendParams
    EmailResponse = EmailResponse
    BatchEmailResponse = BatchEmailResponse

    def __init__(self, client: _HttpClient) -> None:
        self._client = client

    def send(
        self,
        params: SendParams,
        *,
        idempotency_key: Optional[str] = None,
    ) -> EmailResponse:
        payload = _normalize_send_params(params)
        return cast(
            EmailResponse,
            self._client.request(
                "POST",
                "/emails",
                payload,
                idempotency_key=idempotency_key,
            ),
        )

    def send_batch(
        self,
        params: Sequence[SendParams],
        *,
        idempotency_key: Optional[str] = None,
    ) -> BatchEmailResponse:
        payload = [_normalize_send_params(item) for item in params]
        return cast(
            BatchEmailResponse,
            self._client.request(
                "POST",
                "/emails/batch",
                payload,
                idempotency_key=idempotency_key,
            ),
        )


class OpenSend:
    """Instance client for OpenSend APIs."""

    def __init__(self, api_key: str, *, base_url: str = DEFAULT_BASE_URL) -> None:
        self.emails = _EmailsResource(_HttpClient(api_key, base_url))


class Resend(OpenSend):
    """Alias client for code migrating from Resend to OpenSend."""


class Emails:
    """Module-level email resource using ``opensend.api_key``."""

    SendParams = SendParams
    EmailResponse = EmailResponse
    BatchEmailResponse = BatchEmailResponse

    @staticmethod
    def send(
        params: SendParams,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> EmailResponse:
        return _default_emails(api_key=api_key, base_url=base_url).send(
            params,
            idempotency_key=idempotency_key,
        )

    @staticmethod
    def send_batch(
        params: Sequence[SendParams],
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> BatchEmailResponse:
        return _default_emails(api_key=api_key, base_url=base_url).send_batch(
            params,
            idempotency_key=idempotency_key,
        )


def _default_emails(*, api_key: Optional[str], base_url: Optional[str]) -> _EmailsResource:
    key = api_key if api_key is not None else globals()["api_key"]
    if key is None:
        raise ValueError("API key is required; set opensend.api_key or pass api_key=...")
    origin = base_url if base_url is not None else globals()["base_url"]
    return _EmailsResource(_HttpClient(key, origin))


def _normalize_base_url(origin: str) -> str:
    if not origin or not origin.strip():
        raise ValueError("base_url must be a non-empty string when provided")

    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("base_url must be a valid absolute http or https URL")

    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", ""))


def _normalize_send_params(params: SendParams) -> JsonObject:
    payload = dict(cast(Mapping[str, Any], params))

    from_email = payload.pop("from_email", None)
    from_ = payload.pop("from_", None)
    if "from" not in payload:
        if from_email is not None:
            payload["from"] = from_email
        elif from_ is not None:
            payload["from"] = from_

    return payload


def _decode_json(raw: bytes) -> JsonObject:
    if not raw:
        return {}
    decoded = json.loads(raw.decode("utf-8"))
    if isinstance(decoded, dict):
        return cast(JsonObject, decoded)
    raise OpenSendError(
        "Expected a JSON object response from OpenSend",
        status_code=0,
        name="invalid_response",
        code="invalid_response",
    )


def _api_error_from_http_error(error: HTTPError) -> OpenSendError:
    raw = error.read()
    try:
        body: object = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError:
        body = {}

    parsed = body if isinstance(body, dict) else {}
    message = _string(parsed.get("message")) or _string(parsed.get("error")) or error.reason
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


def _string(value: object) -> Optional[str]:
    return value if isinstance(value, str) else None


ApiError = OpenSendError

__all__ = [
    "ApiError",
    "BatchEmailResponse",
    "DEFAULT_BASE_URL",
    "EmailAttachment",
    "EmailResponse",
    "EmailTag",
    "EmailTemplateReference",
    "Emails",
    "OpenSend",
    "OpenSendError",
    "RequestOptions",
    "Resend",
    "SendParams",
    "api_key",
    "base_url",
]
