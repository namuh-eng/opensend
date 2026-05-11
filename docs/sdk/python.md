# Python SDK

OpenSend includes a minimal first-party Python SDK package at
[`packages/python-sdk`](../../packages/python-sdk) for Resend-shaped
transactional email sends.

Use your OpenSend API key (`os_...`) with the Resend-compatible API surface.

## Install

From this repository:

```bash
python -m pip install ./packages/python-sdk
```

The package metadata is prepared for future publishing as `opensend`, but this
change does not publish to PyPI.

## Configure

Store API keys in environment variables; do not hardcode real keys.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://api.opensend.com`.

## Send

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

## Batch send

```python
result = opensend.Emails.send_batch([
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
```

## Errors

Non-2xx responses raise `opensend.OpenSendError` with `status_code`, `name`,
`code`, `message`, and `details` fields when the OpenSend API error envelope
includes them.
