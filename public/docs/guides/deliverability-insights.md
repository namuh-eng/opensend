# Deliverability Insights

OpenSend deliverability views combine send rows, provider lifecycle events, suppressions, logs, and webhook delivery evidence. Use them to decide whether a problem is in your request, your worker/ingester, your domain configuration, your recipient list, or a downstream mailbox provider.

## Where to look first

1. Open **Today** for the last 24 hours of sends, opens, bounces, recent activity, and domain health summary.
2. Open **Emails** and filter to the affected message or status.
3. Open an email detail page and review **Preview**, **Plain text**, **HTML**, and **Insights**.
4. Call `GET /emails/{id}/trace` when you need a chronological API response with request logs, queue/scheduled state, provider events, webhook attempts, and suppression evidence.
5. Open **Suppressions** for recipients blocked by hard bounces, complaints, or manual operator action.

## Metrics OpenSend computes

Dashboard aggregate code calculates:

- Deliverability rate: delivered messages divided by total email volume in the selected range.
- Bounce rate: bounced messages divided by total email volume.
- Complaint rate: complained messages divided by total email volume.
- Bounce breakdown: Permanent, Transient, and Undetermined when provider payloads include bounce type.
- Domain breakdown: per-domain counts and rates where the sending domain can be inferred.

The exact data depends on provider events arriving at the ingester and being written as `email_events` rows. If sends are accepted but delivery events never change, check the ingester and SES/SNS wiring before changing application code.

## Interpreting common statuses

| Status or signal | Meaning | Next step |
| --- | --- | --- |
| `queued` for longer than expected | API accepted the row, but a worker has not sent it yet. | Check queue worker deployment and background job publishing. |
| `scheduled` | The row is intentionally waiting for `scheduled_at`. | Confirm the scheduled time and the scheduled worker. |
| `sent` but no delivered/bounced event | Provider accepted the message, but no final provider event has arrived. | Check SES/SNS subscriptions and ingester logs. |
| `bounced` | Provider reported the recipient could not receive the message. | Inspect bounce type, suppressions, and address quality. |
| `complained` | Recipient reported spam/junk. | Stop non-essential sends to that audience and review consent source. |
| `suppressed` | OpenSend blocked the send before creating or sending a normal email row. | Remove the suppression only with clear consent or corrected address evidence. |
| High opens/clicks missing | Tracking may be disabled on the domain or blocked by client privacy features. | Treat opens as directional, not proof of human reading. |

## Email insight checks

The email detail insight tab flags message-level conditions such as missing plain text, no-reply sender patterns, open/click tracking posture, DMARC guidance, and unsupported embedded-video patterns. These checks are local heuristics; they do not replace mailbox-provider placement testing.

## Operational caveats

- Open and click events require tracking support and can be affected by privacy proxies, image blocking, and link scanners.
- Bounce and complaint data require SES/SNS notifications to reach the OpenSend ingester.
- Suppression records are tenant-scoped; deleting a bounce or complaint suppression should be rare and documented.
- Dedicated IP pools and billing-plan controls are deployment/plan dependent. If unavailable, the dashboard labels those actions as unavailable instead of silently pretending they work.
