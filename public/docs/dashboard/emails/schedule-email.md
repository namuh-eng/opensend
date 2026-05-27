# Schedule Email

Scheduled email lets application code queue a message for future delivery with the `scheduled_at` field. The dashboard shows the accepted email record immediately; the worker sends it when the scheduled time is reached.

## Supported scheduling window

OpenSend accepts future ISO 8601 timestamps with timezone information and the supported small natural-language form such as `in 1 min`, `in 2 hours`, or `in 3 days`. Values must be in the future and within the configured scheduling policy window.

## Canceling

Use the email cancel endpoint or SDK cancel helper before the worker sends the message. After the worker starts delivery, canceling is no longer guaranteed.

## Self-hosted caveat

Scheduled delivery requires the scheduled worker/cron path to run. If scheduled messages remain queued after their due time, verify the worker, queue, and cron authentication configuration.
