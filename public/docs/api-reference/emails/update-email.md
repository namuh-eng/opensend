# Update Scheduled Email

Update a scheduled email before it is sent.

`PATCH /api/emails/{id}`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Only scheduled emails can be updated. Supported fields include schedule-related and mutable message fields accepted by the service.
