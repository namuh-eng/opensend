# Inline Images with CID Attachments

OpenSend can embed inline images by attaching a file with a CID value and referencing it from HTML with a `cid:` URL. The worker builds a MIME message where CID attachments use `Content-Disposition: inline`.

## Minimal CID example

```bash
curl -X POST https://opensend.namuh.co/emails \
  -H "Authorization: Bearer os_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <updates@example.com>",
    "to": "ada@example.com",
    "subject": "Your receipt",
    "html": "<p>Thanks for your order.</p><img src=\"cid:receipt-logo\" alt=\"Acme\" width=\"120\" />",
    "attachments": [
      {
        "filename": "logo.png",
        "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "content_type": "image/png",
        "content_id": "receipt-logo"
      }
    ]
  }'
```

The `content_id` may be provided with or without angle brackets. In HTML, reference the ID without brackets: `cid:receipt-logo`.

## Attachment fields

OpenSend accepts these attachment fields:

- `filename`: required display name.
- `content`: Base64-encoded attachment content.
- `path`: HTTP(S) URL for the worker to fetch before sending.
- `content_type`: optional MIME type. If omitted, OpenSend infers common types from the filename.
- `content_id`: optional CID. When present, the attachment is treated as inline.

## Path attachments

`path` attachments are stored on the email row at API-accept time and fetched by the ingester/queue worker during delivery. The worker refuses unsafe outbound URLs, does not follow redirects, and enforces the same attachment size ceiling after fetching.

Use inline Base64 `content` when the image is small and already available to your app. Use `path` when the image is generated or stored elsewhere, and make sure the URL is reachable from the worker.

## Limits and caveats

- Total attachment content for one email must stay within the 40 MB after-Base64 limit.
- CID rendering varies by mail client. Always include descriptive `alt` text and avoid relying on images for critical content.
- The dashboard can list and retrieve stored attachment metadata/content through the sent-email attachment APIs, but it does not rewrite your HTML image references.
- Do not put secrets or private bearer URLs in `path`; the URL is persisted with the email attachment metadata.
