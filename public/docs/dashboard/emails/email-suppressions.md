# Email Suppressions

Suppressions prevent OpenSend from sending to addresses that should not receive mail. They can be created by hard bounce/complaint events or manual dashboard/API actions.

## Dashboard workflow

- Open **Suppressions** for the dedicated list, search, filters, manual create/delete, bounded CSV import, and sanitized CSV export.
- Open an email detail page to see whether the primary recipient is currently suppressed for the tenant.
- Use **Audience → Contacts** for marketing subscription state and topic preferences. Contact unsubscribe state is related to consent, but it is not the same record as a delivery suppression.

## Important distinction

A contact marked `unsubscribed` controls marketing and topic-preference behavior. A suppression record is a stronger sending-safety record used by the delivery pipeline. Keep both concepts visible in runbooks so support teams do not accidentally re-mail a bounced or complained address.
