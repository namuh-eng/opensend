# Retrieve Received Email

Retrieve one inbound email.

`GET /api/emails/receiving/{id}`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Returns stored inbound content, headers, and metadata where available.
