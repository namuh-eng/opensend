---
date: 2026-06-07
issue: prod-tracking-secret-send-failure
type: mistake
promoted_to: null
---

# Missing TRACKING_SECRET blocks tracked production sends before SES

Open/click tracking in production requires `TRACKING_SECRET` to be set to at
least 16 characters. If a sending domain has tracking enabled and the ingester
task lacks that secret, the worker fails while rendering tracked HTML before
SES accepts the message.

On 2026-06-07, two customer sends were accepted and queued, then exhausted
provider retries with:

`TRACKING_SECRET must be set to at least 16 chars in production`

The fix was to create `opensend/tracking-secret`, wire it into both
`opensend-app` and `opensend-ingester` ECS task definitions, redeploy, and
requeue the failed emails. Future production deploy paths must treat
`TRACKING_SECRET` as a required app + ingester secret whenever tracking can be
enabled.
