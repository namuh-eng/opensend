# Authentication

How API key authentication works in OpenSend.

## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


## API key namespace

OpenSend-issued keys use the `os_` prefix. Keep them in environment variables and secrets managers; never commit them.

## Permission model

API keys may be scoped. Full-access keys can manage resources. Sending-access keys are intended for email send paths. If a route requires full access, the API returns a permission error for narrower keys.

## Dashboard sessions

Dashboard routes use Better Auth browser sessions. Public API routes use API keys. Do not mix these two credential types.
