# Send emails with Python

Send email from Python using the first-party OpenSend Python SDK.

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

Store API keys in environment variables; do not hardcode real keys. If
`OPENSEND_BASE_URL` is unset, the SDK targets OpenSend Cloud at
`https://opensend.namuh.co`.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

## Send

```python
import os
import opensend

opensend.api_key = os.environ["OPENSEND_API_KEY"]
opensend.base_url = os.environ.get("OPENSEND_BASE_URL", opensend.DEFAULT_BASE_URL)

email = opensend.Emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
})

print(email["id"])
```

The SDK also exports `OpenSend` for instance clients and `Resend` as an alias
class for migration-oriented code.
