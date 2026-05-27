# Automation Runs

Runs show how individual contacts or events moved through an automation. Use run detail pages for support, QA, and debugging production flows.

## What to inspect

- Current status: running, waiting, completed, failed, or canceled.
- Step history and timestamps.
- Error messages from failed steps.
- Email IDs created by send-email steps.
- Manual cancellation reason when a run is stopped.

## Operator notes

Runs are persistence-sensitive. Do not delete or rewrite run history during incident response; use it to identify the failing step, then fix the automation, template, domain, or worker configuration.
