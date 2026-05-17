# List Sent Email Attachments

List attachments for a sent email.

`GET /api/emails/{id}/attachments`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Returns attachment metadata for files associated with the sent email.
