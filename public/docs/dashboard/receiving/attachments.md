# Receiving Attachments

Received email attachments are represented as metadata plus a private object key stored by your receiving worker.

## List attachments

Call `GET /emails/receiving/{id}/attachments` to retrieve IDs, filenames, content types, and sizes.

## Download attachments

Call `GET /emails/receiving/{id}/attachments/{attachmentId}` to get a short-lived presigned `download_url`. The API response also includes `expires_at` so clients can request a fresh URL instead of caching it.

## Operator checklist

- Store raw files in a private bucket.
- Save stable attachment IDs and private object keys in the received email row.
- Enforce content-type and size policy before exposing a file to agents or users.
- Scan risky file types before downstream processing.
