# Dashboard Logs

Logs are the low-level request and operational records used to troubleshoot OpenSend. They complement Emails, Broadcasts, Automations, and Webhooks by showing API method, path, status, timestamps, and error context.

## When to use Logs

- An API call failed and the SDK returned an error.
- A dashboard action did not create the expected object.
- A worker or webhook delivery needs investigation.
- Support needs to correlate an email ID with an API request.

## Audit log distinction

Logs are for troubleshooting runtime/API behavior. The Audit Log is for user and account actions. Use both during incidents: logs explain what the system did, while audit events explain who changed configuration.


## Tag filters

The Logs page can filter request logs by an email tag name and optional value. OpenSend matches logs to emails through sanitized request-log metadata, then applies the stored email tag predicate within the current tenant. This keeps cross-tenant tag queries impossible and avoids exposing raw request secrets or message bodies.

Use the same tag shape as send requests: names and values may contain ASCII letters, numbers, underscores, and dashes. Values may be empty when that is the stored tag value.
