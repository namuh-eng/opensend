# opensend Python SDK

Minimal first-party Python SDK for OpenSend transactional email sends with a
Resend-shaped API surface.

## Installation

This package is staged for future PyPI publishing. From this repository today:

```bash
python -m pip install ./packages/python-sdk
```

After publication, the intended package install is:

```bash
python -m pip install opensend
```

## Setup

Use an environment variable instead of hardcoding API keys:

```bash
export OPENSEND_API_KEY="re_your_api_key"
```

For self-hosted OpenSend, point the SDK at your deployment origin. The default
hosted origin is `https://api.opensend.com`.

```bash
export OPENSEND_BASE_URL="http://localhost:3015"
```

## Send an email

The module-level surface mirrors Resend's Python ergonomics:

```python
import os
import opensend

opensend.api_key = os.environ["OPENSEND_API_KEY"]
opensend.base_url = os.environ.get("OPENSEND_BASE_URL", opensend.DEFAULT_BASE_URL)

params: opensend.Emails.SendParams = {
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
}

email = opensend.Emails.send(params)
print(email["id"])
```

Python reserves `from` as a keyword argument name, but dictionary keys can still
use the OpenSend/Resend JSON field name. If you prefer constructing dictionaries
with Python identifiers, the SDK also accepts `from_` or `from_email` and sends
that value as JSON `from`.

```python
params: opensend.SendParams = {
    "from_": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from OpenSend",
    "text": "It works!",
}
```

## Batch send

```python
result = opensend.Emails.send_batch([
    {
        "from": "hello@yourdomain.com",
        "to": "a@example.com",
        "subject": "Hi A",
        "html": "<p>A</p>",
    },
    {
        "from": "hello@yourdomain.com",
        "to": "b@example.com",
        "subject": "Hi B",
        "html": "<p>B</p>",
    },
])

print(result["data"])
```

## Instance client

```python
from opensend import OpenSend

client = OpenSend(
    os.environ["OPENSEND_API_KEY"],
    base_url=os.environ.get("OPENSEND_BASE_URL", "https://api.opensend.com"),
)

email = client.emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
})
```

`Resend` is also exported as an alias class for migration-oriented code:

```python
from opensend import Resend

client = Resend(os.environ["OPENSEND_API_KEY"], base_url="http://localhost:3015")
```

## Errors

Non-2xx API responses raise `opensend.OpenSendError` (also exported as
`opensend.ApiError`). The exception keeps OpenSend's public error envelope fields
when present.

```python
try:
    opensend.Emails.send(params)
except opensend.OpenSendError as error:
    print(error.status_code, error.code, error.message, error.details)
```

## Supported first slice

- `opensend.Emails.send(params)` → `POST /emails`
- `opensend.Emails.send_batch(params)` → `POST /emails/batch`
- Bearer API key auth
- Configurable base URL
- Optional `idempotency_key=` request header
- Typed request/response structures for transactional email sends

This first package intentionally does not implement the full Resend resource
surface yet.

## Tests

```bash
python -m unittest discover packages/python-sdk/tests
```
