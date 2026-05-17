# Retrieve Sent Email

Retrieve one sent email and its current state.

`GET /api/emails/{id}`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Returns message metadata, current status, tags, timestamps, and related detail fields.
