# Send emails with Django

Use the Python SDK from Django views, management commands, or background jobs.

## Install

```bash
python -m pip install ./packages/python-sdk
```

After the Python package is published, replace the local install with `python -m pip install opensend`.

## Settings

```python
import os

OPENSEND_API_KEY = os.environ["OPENSEND_API_KEY"]
OPENSEND_BASE_URL = os.environ.get("OPENSEND_BASE_URL")
```

## Client helper

Create `emails.py` in one of your Django apps:

```python
from django.conf import settings
from opensend import OpenSend

client = OpenSend(
    settings.OPENSEND_API_KEY,
    base_url=settings.OPENSEND_BASE_URL,
)

def send_welcome_email(email_address: str) -> str:
    email = client.emails.send({
        "from": "OpenSend <onboarding@updates.example.com>",
        "to": email_address,
        "subject": "Welcome",
        "html": "<p>Django queued this email.</p>",
    })
    return email["id"]
```

## View example

```python
import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .emails import send_welcome_email

@require_POST
def send_email(request):
    body = json.loads(request.body or b"{}")
    email_address = body.get("email")
    if not email_address:
        return JsonResponse({"error": "email is required"}, status=400)

    email_id = send_welcome_email(email_address)
    return JsonResponse({"id": email_id})
```

## Notes

- Prefer Celery, RQ, or your existing job system for sends triggered by user-facing requests.
- Add idempotency keys in jobs that can retry.
- Store secrets in your deployment platform, not in `settings.py` committed to git.
