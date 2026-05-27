# Audience Properties

Properties define custom fields stored on contacts. They are useful for personalization, filtering, support context, and automation conditions.

## Examples

- `plan`: free, pro, enterprise
- `company`: customer organization
- `signup_source`: landing page or referral
- `last_seen_at`: application timestamp

## Best practices

Keep property names stable and documented. Avoid high-risk sensitive data such as passwords, tokens, medical data, or payment details. If a value is only needed for one email, pass it as a template variable instead of storing it permanently on the contact.
