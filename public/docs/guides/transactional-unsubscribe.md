# Add Unsubscribe Links to Transactional Emails

OpenSend can replace the managed unsubscribe placeholder in a single-recipient email with a signed unsubscribe URL for an existing contact. The same replacement adds one-click unsubscribe headers.

Use this for messages that should honor a recipient preference, such as product updates, education, lifecycle nudges, or notifications that are not strictly required for account security or purchase completion.

## Placeholder

Add the OpenSend unsubscribe placeholder to your HTML or text body:

```html
<p>
  You can stop these product updates at any time:
  <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">unsubscribe</a>.
</p>
```

```text
Stop these product updates: {{{RESEND_UNSUBSCRIBE_URL}}}
```

When the send is accepted, OpenSend looks up the sole `to` recipient in your tenant's contacts. If the contact exists and is not already unsubscribed, OpenSend replaces every placeholder occurrence with `/unsubscribe/{contactId}?token=...` and adds:

- `List-Unsubscribe: <https://your-opensend-host/unsubscribe/{contactId}?token=...>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

## Example send

```bash
curl -X POST https://opensend.namuh.co/emails \
  -H "Authorization: Bearer os_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <updates@example.com>",
    "to": "ada@example.com",
    "subject": "Product activity summary",
    "html": "<p>Your workspace processed 42 events today.</p><p><a href=\"{{{RESEND_UNSUBSCRIBE_URL}}}\">Unsubscribe from product summaries</a></p>",
    "text": "Your workspace processed 42 events today. Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}"
  }'
```

## Requirements and boundaries

- The email must have exactly one `to` recipient. Multi-recipient sends are left unchanged.
- The recipient must already exist as a contact for the authenticated tenant.
- If the contact is already unsubscribed, OpenSend leaves the placeholder unchanged and does not add unsubscribe headers.
- The public unsubscribe route marks the contact as `unsubscribed` after verifying the HMAC token.
- Production deployments must set `UNSUBSCRIBE_SECRET` to at least 16 characters so signed links remain stable and private across deploys.

## Transactional vs marketing use

OpenSend does not decide whether a message is legally transactional or marketing. Your application owns that classification. If a message is optional, promotional, or preference-based, include the placeholder or use topics/broadcasts so recipients can opt out. If a message is required for account security, fraud prevention, or a purchase the recipient requested, keep it focused on that purpose and avoid adding unrelated marketing content.

## Related dashboard surfaces

- **Audience → Contacts** shows contact unsubscribe state.
- **Audience → Topics** manages preference categories.
- **Audience → Topics → Unsubscribe page customization** edits the hosted confirmation page.
- **Settings → Unsubscribe Page** currently shows a preview-only settings tab; use the Topics editor for live customization.
