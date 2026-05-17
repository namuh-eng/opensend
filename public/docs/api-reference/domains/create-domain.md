# Create Domain

Add a sending domain.

`POST /api/domains`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Creates a domain record and returns DNS records needed for verification.
