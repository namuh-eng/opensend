# Automation Send Email Step

The send-email step queues an email as part of an automation run. It can reference templates and recipient data collected from the trigger or contact record.

## Before using it

- Verify the sending domain.
- Confirm the recipient has appropriate consent for the message type.
- Use templates for reusable content and variable validation.
- Include unsubscribe/topic links for marketing or lifecycle mail that requires preference management.

## Failures

If a send-email step fails, inspect the run detail and related logs. Common causes are missing template variables, unverified domains, suppressed recipients, quota limits, or worker/provider errors.
