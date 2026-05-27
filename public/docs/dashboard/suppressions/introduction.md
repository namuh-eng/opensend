# Dashboard Suppressions

OpenSend suppression behavior is visible across email detail, contacts, unsubscribe workflows, and APIs. There is not a separate full suppressions dashboard page in this repo yet; use the available dashboard surfaces plus the suppressions API for operational management.

## Where to look

- **Emails → detail**: see whether the primary recipient is suppressed.
- **Audience → Contacts**: inspect subscribed/unsubscribed state.
- **Audience → Topics**: manage preference categories.
- **Logs**: investigate writes, failed sends, or provider events.
- Suppressions API: list, create, get, and delete suppression records.

## Operator guidance

Treat bounce and complaint suppressions as safety records. Removing them should require deliberate evidence that the address is valid and consent remains intact.
