# Send Batch Emails

Queue up to 100 emails in one request.

`POST /emails/batch`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Send an array of email payloads. Use an `Idempotency-Key` header to make retries safe for the whole batch.

## Example

```bash
curl -X POST https://opensend.namuh.co/emails/batch \
  -H "Authorization: Bearer os_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"from":"Acme <news@example.com>","to":["a@example.com"],"subject":"A","html":"<p>A</p>"}]'
```

## Response

```json
{ "data": [{ "id": "email_id" }] }
```
