# Retrieve Sent Email Attachment

Download or retrieve a sent email attachment.

`GET /api/emails/{id}/attachments/{attachmentId}`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Use this route to retrieve attachment content for a sent email.
