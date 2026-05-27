# Get Received Email Content

Use the received email detail API to fetch parsed content after your receiving worker stores a row.

## List then retrieve

```bash
OPENSEND_BASE_URL="https://opensend.namuh.co"
OPENSEND_API_KEY="os_YOUR_API_KEY"

bun -e 'const base=process.env.OPENSEND_BASE_URL; const key=process.env.OPENSEND_API_KEY; const r=await fetch(`${base}/emails/receiving?limit=1`,{headers:{Authorization:`Bearer ${key}`}}); console.log(await r.text())'
```

Then call `GET /emails/receiving/{id}` for the row you need.

## Fields

The detail response returns the parsed sender, recipients, subject, `html`, `text`, and `created_at`. It does not return raw MIME headers or attachment binaries.

## Safety

Email content is untrusted input. Sanitize HTML before rendering it in custom dashboards and keep raw MIME out of model prompts unless you have a dedicated parser and policy layer.
