# Dashboard Logs

Logs are the low-level request and operational records used to troubleshoot OpenSend. They complement Emails, Broadcasts, Automations, and Webhooks by showing API method, path, status, timestamps, and error context.

## When to use Logs

- An API call failed and the SDK returned an error.
- A dashboard action did not create the expected object.
- A worker or webhook delivery needs investigation.
- Support needs to correlate an email ID with an API request.

## Audit log distinction

Logs are for troubleshooting runtime/API behavior. The Audit Log is for user and account actions. Use both during incidents: logs explain what the system did, while audit events explain who changed configuration.
