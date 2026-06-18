# Reply To Received Emails

OpenSend now links inbound replies to outbound messages when the sending domain is also a verified receiving domain.

## How reply tracking works

When `POST /emails` or `POST /emails/batch` accepts a message from a verified domain with the `receiving` capability enabled, OpenSend stores a stable thread ID, reply token, and reply address on the outbound `emails` row. If the API request did not provide `reply_to`, OpenSend uses a generated address such as:

```text
reply+osr_<email_id>_<signature>@inbound.example.com
```

OpenSend also adds first-party reply headers, including `X-OpenSend-Reply-Token`, so providers that preserve headers can still thread replies even when a user agent changes the envelope recipient.

## Inbound matching

The standalone ingester parses inbound MIME, resolves the recipient to one tenant, then validates reply tokens from the recipient address, `X-OpenSend-Reply-Token`, `In-Reply-To`, or `References`. Tokens are tenant- and domain-scoped, so a token from another tenant cannot attach a message to the wrong account.

Matched replies store:

- `reply_match_status: "matched"`
- `reply_to_email_id` for the original outbound email
- `thread_id` shared with the outbound email
- `contact_id` when the inbound sender matches a tenant contact

Unmatched inbound messages remain stored and visible with `reply_match_status: "unmatched"` so operators can audit routed mail that did not belong to an existing conversation.

## Dashboard workflow

Open an outbound email detail page to see the generated reply address and conversation thread. The thread shows the original sent message plus matched inbound replies for support context. Received-email API detail responses expose the same thread metadata for custom support tools.

## Self-hosted operator setup

1. Verify the sending domain in OpenSend and enable the `receiving` capability.
2. Publish inbound MX/provider records for that domain.
3. Route provider notifications or raw MIME fetches to the standalone ingester. Use `POST /events/inbound/ses-s3` for SES receipt-rule S3/SNS notifications, or `POST /events/inbound` for a trusted provider that can POST raw MIME directly.
4. Configure `INGESTER_INBOUND_TOKEN` for production provider callbacks; production ingesters reject inbound MIME requests without it.
5. Set `OPENSEND_REPLY_TOKEN_SECRET` consistently for the app and ingester processes. If omitted, OpenSend falls back to the auth secret variables when present; production deployments should use an explicit secret so reply tokens survive app restarts and deploys.
6. Keep route/catch-all policies narrow enough to avoid receiving mail for unrelated tenants. Cross-tenant or invalid tokens are stored as unmatched messages for the resolved recipient-domain tenant; arbitrary unrouted mail without a reply token remains rejected as missing-domain.
