# Email Suppressions

Suppressions prevent OpenSend from sending to addresses that should not receive mail. They can be created by bounce/complaint events, unsubscribe flows, or manual API actions. The dashboard surfaces suppression state on email detail and audience/contact views.

## Dashboard workflow

- Open an email detail page to see whether the primary recipient is suppressed.
- Use **Audience → Contacts** to see subscribed versus unsubscribed contact state.
- Use **Audience → Topics** and the unsubscribe page editor for preference-management flows.
- Use the suppressions API when you need a dedicated operational list or manual create/delete actions.

## Important distinction

A contact marked `unsubscribed` controls marketing and topic-preference behavior. A suppression record is a stronger sending-safety record used by the delivery pipeline. Keep both concepts visible in runbooks so support teams do not accidentally re-mail a bounced or complained address.
