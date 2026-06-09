# Email Bounces

Bounces are delivery-provider events recorded after SES rejects or later reports a message as undeliverable. In the dashboard, bounce information appears through the email lifecycle status, related logs, metrics, and suppression indicators.

## How to investigate a bounce

1. Open **Emails** and filter to bounced messages or open the specific email ID.
2. Review the recipient, sending domain, and event timeline.
3. Open **Logs** for the API request and worker/provider follow-up records.
4. Check the recipient suppression state. Hard bounces should prevent future sends to the same address.
5. Review domain authentication in **Domains** if many unrelated recipients are bouncing.

## Self-hosted caveat

Bounce status depends on SES/SNS events reaching the ingester. If API sends succeed but bounces never appear, check the ingester deployment and SNS subscription before changing application code.
