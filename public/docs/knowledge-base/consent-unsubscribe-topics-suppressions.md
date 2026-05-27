# Consent, unsubscribes, topics, and suppressions

OpenSend has several related safety concepts. Use them together instead of treating them as one field.

## Contacts and unsubscribes

A contact can be subscribed or unsubscribed. This controls whether marketing or audience workflows should target that contact.

## Topics

Topics let recipients choose categories of mail. They are useful when someone wants product updates but not newsletters, or billing notices but not campaigns.

## Suppressions

Suppressions are stronger safety records created by bounces, complaints, manual blocks, or unsubscribe workflows. The sending pipeline should treat suppressed recipients as blocked.

## Recommended policy

- Do not send marketing mail to unsubscribed contacts.
- Do not remove complaint/bounce suppressions without evidence.
- Keep transactional sends narrowly tied to account or purchase activity.
- Log consent source in your application or contact properties when possible.
