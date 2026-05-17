# Send Email

Send one email through OpenSend.

`POST /emails`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


## Body

Required fields:

- `from` — sender address, optionally with a display name.
- `to` — recipient string or array.
- `subject` — subject line.
- `html`, `text`, `react`, or `template` content depending on client path.

Optional fields include `cc`, `bcc`, `reply_to`, `headers`, `attachments`, `tags`, `scheduled_at`, and `topic_id`.

## Example

```bash
curl -X POST https://api.opensend.com/emails \
  -H "Authorization: Bearer os_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: welcome-001" \
  -d '{"from":"Acme <onboarding@example.com>","to":["user@example.com"],"subject":"Welcome","html":"<p>Hello</p>"}'
```

## Response

```json
{ "id": "email_id" }
```
