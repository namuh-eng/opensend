# Python SDK

OpenSend includes a minimal first-party Python SDK package at
[`packages/python-sdk`](../../packages/python-sdk) for transactional email sends
with a familiar API surface.

Use your OpenSend API key (`os_...`) with OpenSend as a Resend alternative.
Selected alias compatibility remains available for migration-oriented code.

## Install

From this repository before the PyPI release:

```bash
python -m pip install ./packages/python-sdk
```

After `opensend==0.1.0` is published to PyPI, install with:

```bash
python -m pip install opensend==0.1.0
```

Until that publish happens, use the repository install shown above.

## Configure

Store API keys in environment variables; do not hardcode real keys.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`.

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
