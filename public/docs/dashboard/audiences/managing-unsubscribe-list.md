# Managing the Unsubscribe List

Unsubscribe management protects recipient consent and sender reputation. OpenSend supports contact-level unsubscribe state, topics, unsubscribe page customization, and suppression records from delivery safety events.

## Dashboard workflow

1. Use **Audience → Contacts** to inspect a contact's subscription state.
2. Use **Audience → Topics** to define preference categories.
3. Use the unsubscribe page editor to customize the hosted preference page recipients see after clicking an unsubscribe link.
4. Use email detail and suppression APIs to investigate bounces, complaints, and manual suppressions.

## Consent rules

Do not re-subscribe a contact unless you have clear evidence of renewed consent. For marketing mail, include an unsubscribe link and honor requests promptly. Transactional messages should be limited to account or purchase activity that the recipient expects.

Browser opens of signed unsubscribe links render preferences without changing the contact. One-click unsubscribe POST requests and explicit browser form submissions are the mutating paths. Topic saves update the signed contact's topic preferences; unsubscribe-all marks the contact globally unsubscribed.
