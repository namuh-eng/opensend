# Send emails with Python

Send email from Python using the first-party OpenSend Python SDK. It works in scripts, workers, Django, Flask, FastAPI, and any service that can make HTTPS requests.

## Install

Until the PyPI release is complete, install from this repository:

```bash
python -m pip install ./packages/python-sdk
```

After `opensend==0.1.0` is published to PyPI, install the pinned package:

```bash
python -m pip install opensend==0.1.0
```

## Configure

Store API keys in environment variables; do not hardcode real keys. If `OPENSEND_BASE_URL` is unset, the SDK targets OpenSend Cloud at `https://opensend.namuh.co`.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

## Instance client

Use the instance client in applications and tests because it keeps configuration explicit.

```python
import os
from opensend import OpenSend

client = OpenSend(
    os.environ["OPENSEND_API_KEY"],
    base_url=os.environ.get("OPENSEND_BASE_URL"),
)

email = client.emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
})

print(email["id"])
```

Python reserves `from` as a keyword, so send payloads are dictionaries. The SDK also accepts `from_` and `from_email` keys and normalizes them to the REST `from` field.

## Module-level shorthand

The module-level API is convenient for small scripts:

```python
import os
import opensend

opensend.api_key = os.environ["OPENSEND_API_KEY"]
opensend.base_url = os.environ.get("OPENSEND_BASE_URL", opensend.DEFAULT_BASE_URL)

email = opensend.Emails.send({
    "from": "hello@yourdomain.com",
    "to": ["a@example.com", "b@example.com"],
    "subject": "Hello from OpenSend",
    "text": "It works!",
})
print(email["id"])
```

## Idempotency

```python
email = client.emails.send(
    {
        "from": "hello@yourdomain.com",
        "to": "recipient@example.com",
        "subject": "Receipt",
        "html": "<p>Thanks for your purchase.</p>",
    },
    idempotency_key="receipt-123",
)
```

## Batch sending

```python
result = client.emails.send_batch([
    {
        "from": "hello@yourdomain.com",
        "to": "a@example.com",
        "subject": "Hello A",
        "html": "<p>A</p>",
    },
    {
        "from": "hello@yourdomain.com",
        "to": "b@example.com",
        "subject": "Hello B",
        "html": "<p>B</p>",
    },
])
print([item["id"] for item in result["data"]])
```

## Framework guides

- [FastAPI](./send-with-fastapi.md)
- [Flask](./send-with-flask.md)
- [Django](./send-with-django.md)
