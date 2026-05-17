# List Contacts

List contacts.

`GET /contacts`


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.



## Pagination

List endpoints use cursor-style pagination where available. Prefer `limit` plus `after` for forward pagination. Responses may include `has_more` and a `data` array depending on the resource.
