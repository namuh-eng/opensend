# Cancel Email

Cancel a scheduled email.

`POST /emails/{email_id}/cancel`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Returns the canceled email id when the transition succeeds.
