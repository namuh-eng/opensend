# Dashboard Topics

Topics let contacts manage categories of mail instead of using a single all-or-nothing unsubscribe preference. Use topics for product updates, newsletters, billing notices, education, or announcements.

## Configuration

A topic has a name, description, visibility, and default subscription behavior.

- `opt_in`: contacts receive topic mail unless they explicitly opt out.
- `opt_out`: contacts do not receive topic mail unless they explicitly opt in.
- `public`: all signed contacts in the tenant can see the topic on the hosted preference page.
- `private`: only contacts with an explicit preference for the topic can see it on the hosted preference page.

Default subscription is chosen when the topic is created. The Resend-compatible `/topics/{id}` API does not allow changing it later; use a new topic if the default policy changes.

Broadcast unsubscribe links use topic context when the broadcast has a topic. Contacts can then save topic-level preferences or unsubscribe from all marketing mail. Broadcasts without a topic use the same hosted page but present the global unsubscribe action as the primary choice.

## Best practices

Keep topic names understandable to recipients. Do not hide marketing mail behind vague labels. For compliance-sensitive programs, document which messages are transactional and which require topic-level consent.
