# opensend Python SDK

First-party Python SDK for the OpenSend email platform. Covers the full API
surface — transactional emails, domains, API keys, contacts, segments,
audiences, broadcasts, templates, automations, events, webhooks, topics,
suppressions, and logs.

Use your OpenSend API key (`os_...`) with either the OpenSend hosted service
or a self-hosted deployment. The `Resend` class is also exported as an alias
for teams migrating from Resend to OpenSend.

## Installation

From this repository before the PyPI release:

```bash
python -m pip install ./packages/python-sdk
```

After the package is published to PyPI:

```bash
python -m pip install opensend
```

## Setup

Keep API keys out of source code — use an environment variable:

```bash
export OPENSEND_API_KEY="os_your_api_key"
```

For self-hosted OpenSend, set a custom base URL. The default is
`https://opensend.namuh.co`.

```bash
export OPENSEND_BASE_URL="http://localhost:3015"
```

## Quick start — instance client (recommended)

```python
import os
from opensend import OpenSend

client = OpenSend(
    os.environ["OPENSEND_API_KEY"],
    base_url=os.environ.get("OPENSEND_BASE_URL"),
)

# Send a transactional email
email = client.emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
})
print(email["id"])
```

Python reserves `from` as a keyword, so dictionary keys use the JSON field
name directly. You can also use `from_` or `from_email` as dict keys — the SDK
normalises them before sending:

```python
email = client.emails.send({
    "from_": "hello@yourdomain.com",
    "to": ["a@example.com", "b@example.com"],
    "subject": "Hello",
    "text": "It works!",
})
```

## Module-level API (shorthand)

```python
import os
import opensend

opensend.api_key = os.environ["OPENSEND_API_KEY"]

email = opensend.Emails.send({
    "from": "hello@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Hello from OpenSend",
    "html": "<h1>It works!</h1>",
})
```

## Emails

```python
# Send a single email
email = client.emails.send({...})

# Send multiple emails in one request
result = client.emails.send_batch([{...}, {...}])

# List sent emails
page = client.emails.list({"limit": 25, "status": "delivered"})

# Retrieve a single email
detail = client.emails.get("em_abc123")

# Cancel a scheduled email
client.emails.cancel("em_abc123")
```

## Domains

```python
domain = client.domains.create({"name": "mail.example.com", "region": "us-east-1"})
domains = client.domains.list()
domain = client.domains.get("dom_abc123")
client.domains.update("dom_abc123", {"open_tracking": True, "click_tracking": True})
client.domains.verify("dom_abc123")   # trigger re-verification of DNS records
client.domains.delete("dom_abc123")
```

## API Keys

```python
key = client.api_keys.create({"name": "CI key"})
print(key["token"])  # store this — returned only on creation

keys = client.api_keys.list()
client.api_keys.delete("key_abc123")
```

## Contacts

```python
contact = client.contacts.create({
    "email": "user@example.com",
    "first_name": "Alice",
    "last_name": "Smith",
})

page = client.contacts.list({"limit": 50, "after": "cursor_abc"})
contact = client.contacts.get("c_abc123")
client.contacts.update("c_abc123", {"unsubscribed": True})
client.contacts.delete("c_abc123")
```

## Segments

```python
segment = client.segments.create({"name": "VIP customers"})
page = client.segments.list({"search": "VIP", "limit": 10})
segment = client.segments.get("seg_abc123")
client.segments.delete("seg_abc123")

# List contacts in a segment
contacts = client.segments.list_contacts("seg_abc123", {"limit": 100})
```

## Audiences

```python
audience = client.audiences.create({"name": "Newsletter"})
page = client.audiences.list({"search": "News"})
audience = client.audiences.get("aud_abc123")
client.audiences.delete("aud_abc123")
```

## Broadcasts

```python
# Create a broadcast (bulk email campaign)
broadcast = client.broadcasts.create({
    "name": "May Newsletter",
    "subject": "What's new in May",
    "html": "<p>Hello!</p>",
    "segment_id": "seg_abc123",
}, idempotency_key="may-newsletter-2026")

page = client.broadcasts.list({"status": "draft", "limit": 20})
broadcast = client.broadcasts.get("bcast_abc123")
client.broadcasts.update("bcast_abc123", {"subject": "Updated subject"})
client.broadcasts.delete("bcast_abc123")

# Send immediately or schedule
result = client.broadcasts.send("bcast_abc123", idempotency_key="send-may-2026")
# Schedule for later:
result = client.broadcasts.send("bcast_abc123", {"scheduled_at": "2026-06-01T09:00:00Z"})
```

## Templates

```python
template = client.templates.create({
    "name": "Welcome Email",
    "subject": "Welcome to {{company_name}}",
    "html": "<p>Hi {{first_name}}, welcome!</p>",
    "variables": [
        {"key": "first_name", "type": "string", "required": True},
        {"key": "company_name", "type": "string", "fallback_value": "OpenSend"},
    ],
})

page = client.templates.list({"status": "published", "search": "Welcome"})
template = client.templates.get("tmpl_abc123")           # by ID
template = client.templates.get("welcome-email")         # or by alias
client.templates.update("tmpl_abc123", {"name": "Updated Welcome"})
client.templates.delete("tmpl_abc123")
client.templates.publish("tmpl_abc123")                  # publish draft version
duplicate = client.templates.duplicate("tmpl_abc123")    # copy to new template
```

## Automations

```python
automation = client.automations.create({
    "name": "Welcome flow",
    "trigger_event_name": "user.signed_up",
    "steps": [
        {"key": "trigger", "type": "trigger"},
        {"key": "send_welcome", "type": "send_email", "config": {"template_id": "tmpl_abc123"}},
    ],
    "connections": [
        {"from_key": "trigger", "to": "send_welcome"},
    ],
})

page = client.automations.list(status="enabled")
automation = client.automations.get("auto_abc123")
client.automations.update("auto_abc123", {"status": "disabled"})
client.automations.delete("auto_abc123")

# Runs
runs = client.automations.list_runs("auto_abc123", {"status": "completed", "limit": 20})
run = client.automations.get_run("auto_abc123", "run_abc123")
client.automations.cancel_run("auto_abc123", "run_abc123", {"reason": "manual cancel"})
metrics = client.automations.get_run_metrics("auto_abc123", {
    "from_date": "2026-01-01",
    "to_date": "2026-05-01",
})
```

## Events

```python
# Define a custom event schema
event_schema = client.events.create({"name": "user.signed_up", "schema": {"plan": "string"}})

schemas = client.events.list({"limit": 10})

# Fire a custom event (resumes waiting automation runs)
delivery = client.events.send({
    "event": "user.signed_up",
    "email": "user@example.com",
    "payload": {"plan": "pro"},
})
```

## Webhooks

```python
webhook = client.webhooks.create(
    {"endpoint": "https://example.com/hooks/opensend", "events": ["email.sent", "email.bounced"]},
    idempotency_key="create-webhook-1",
)
print(webhook["signing_secret"])  # store securely — returned only on creation

page = client.webhooks.list({"limit": 10})
detail = client.webhooks.get("wh_abc123")      # includes recent_deliveries
client.webhooks.update("wh_abc123", {"status": "disabled"})
client.webhooks.delete("wh_abc123")

deliveries = client.webhooks.list_deliveries("wh_abc123", {"limit": 20})
replay = client.webhooks.replay_delivery("wh_abc123", "del_abc123")
```

## Topics

```python
topic = client.topics.create({
    "name": "Product Updates",
    "visibility": "public",
    "default_subscription": "opt_in",
})

page = client.topics.list({"search": "Product"})
topic = client.topics.get("top_abc123")
client.topics.update("top_abc123", {"name": "Latest Product News"})
client.topics.delete("top_abc123")
```

## Suppressions

```python
page = client.suppressions.list({"limit": 50})
item = client.suppressions.get("bounce@example.com")

client.suppressions.create(
    {"email": "bounce@example.com", "reason": "manual"},
    idempotency_key="suppress-bounce",
)
client.suppressions.delete("bounce@example.com")
```

## Logs

```python
page = client.logs.list({
    "status": "200",
    "method": "POST",
    "date_from": "2026-01-01",
    "date_to": "2026-05-31",
    "limit": 100,
})
log = client.logs.get("log_abc123")
```

## Idempotency

Pass `idempotency_key=` on any method that supports it (emails, broadcasts,
webhooks, suppressions) to deduplicate retried requests:

```python
email = client.emails.send(
    {"from": "hello@yourdomain.com", "to": "user@example.com", "subject": "Hi", "html": "Hi"},
    idempotency_key="order-confirmation-42",
)
```

## Error handling

Non-2xx responses raise `opensend.OpenSendError` (also exported as
`opensend.ApiError`):

```python
import opensend

try:
    client.emails.send({...})
except opensend.OpenSendError as err:
    print(err.status_code)  # HTTP status
    print(err.name)         # e.g. "validation_error"
    print(err.code)         # machine-readable code
    print(err.message)      # human-readable message
    print(err.details)      # dict or None
```

## Resend alias

`Resend` is exported as a drop-in alias for `OpenSend` for teams migrating
from Resend:

```python
from opensend import Resend

client = Resend(os.environ["OPENSEND_API_KEY"])
email = client.emails.send({...})
```

## Running tests

```bash
cd packages/python-sdk
python3 -m venv .venv
.venv/bin/pip install pytest
.venv/bin/pytest tests/ -v
```
