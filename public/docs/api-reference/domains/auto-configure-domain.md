# Auto Configure Domain

Write DNS records through configured Cloudflare credentials.

`POST /api/domains/{id}/auto-configure`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


This is an operator/self-host helper and requires Cloudflare environment configuration.
