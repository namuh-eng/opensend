# Broadcast Performance Tracking

Broadcast performance combines accepted send counts, delivery events, opens, clicks, bounces, complaints, and unsubscribes recorded through the OpenSend pipeline. Use it after a campaign to understand whether the audience, domain, and content are healthy.

## What to watch

- High bounce rate: list quality or stale addresses.
- High complaint rate: consent, frequency, or content mismatch.
- Low delivery with many queued rows: worker/SES quota or provider issue.
- Missing opens/clicks: tracking domain configuration or privacy filtering.

## Self-hosted caveat

Open/click tracking requires the tracking routes and configured tracking domain. Delivery, bounce, and complaint metrics require SES/SNS events to reach the ingester.
