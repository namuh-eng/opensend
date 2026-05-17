# Create API Key

Create a new API key.

`POST /api-keys`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


Requires a full-access key. Store the returned secret immediately; only a hash is persisted.
