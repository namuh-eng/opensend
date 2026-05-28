# Forward Received Emails

OpenSend can automatically forward stored inbound messages after MIME ingestion and receiving-route resolution succeeds.

Create forwarding rules from the Receiving dashboard or `POST /api/receiving/forwarding-rules`. A rule belongs to one receiving route and contains one or more destination addresses. When a received email matches that route, OpenSend preserves the original `received_emails` row and creates a separate forwarding attempt/result.

Forwarded messages are recomposed as outbound emails through the existing send queue boundary:

- `from` is the matched route target address, such as `support@inbound.example.com`.
- `reply_to` points at the original inbound sender.
- `subject` is prefixed with `Fwd:` unless it already starts with a forward prefix.
- Audit headers identify the original received email ID and forwarding rule ID.
- Stored inbound attachments remain on the received email row; forwarding uses the configured storage download boundary when attachments are available.

## Safety states

Forwarding rules can be `active`, `disabled`, or `invalid`.

- Active rules queue forwarding attempts for matching inbound messages.
- Disabled rules do not forward, but matching messages still create visible skipped attempts.
- Invalid rules are not silently ignored; matching messages create skipped attempts with the invalid reason.

OpenSend blocks active rules that would forward back into the same receiving domain or matched receiving address. This loop-prevention guard protects exact routes, aliases, and catch-all routes from recursively re-entering the same inbound pipeline.

## Visibility

The Receiving dashboard shows each route's forwarding destinations, rule status, and latest forwarding attempt. The forwarding rules API returns the same latest-attempt summary for API clients.
