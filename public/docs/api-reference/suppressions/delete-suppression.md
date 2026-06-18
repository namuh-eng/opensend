# Delete Suppression

Remove one tenant-scoped suppression by email address.

`DELETE /api/suppressions/{email}`

## Authentication

Use a full-access OpenSend API key for public API clients. The dashboard uses the same handler with an authenticated dashboard session.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Safety

Deleting a suppression is an irreversible operational action. Future sends to the address can proceed unless another suppression or consent rule blocks them. For bounce and complaint suppressions, remove the row only after confirming address health and consent.

## Response

```json
{
  "object": "suppression",
  "deleted": true
}
```

A missing or cross-tenant suppression returns `404`.
