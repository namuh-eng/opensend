# Managing Unsubscribed Contacts

OpenSend stores unsubscribe state on contacts and exposes unsubscribe flows for recipient preference handling, including a customizable confirmation page operators can brand to match their product.

## How unsubscribes work

When a contact clicks the one-click unsubscribe link included in every outbound email, OpenSend marks their contact record as `unsubscribed: true` and renders a confirmation page. The contact will no longer receive marketing emails from your account.

The unsubscribe link is automatically appended to outbound emails via the `List-Unsubscribe` and `List-Unsubscribe-Post` headers, which support RFC 8058 one-click unsubscribes.

## Customizing the confirmation page

Operators can brand the unsubscribe confirmation page from the dashboard or via the API.

### Dashboard

Navigate to **Audience → Topics → Edit Unsubscribe Page**. The editor provides:

- **Logo URL** — a full `http` or `https` URL to an image displayed at the top of the page. Leave blank to hide the logo.
- **Brand color** — a hex color (`#rrggbb` or `#rrggbbaa`) applied to the page accent and icon border.
- **Headline** — the main heading shown on the success confirmation (max 200 characters).
- **Message** — the body text shown below the headline (max 1000 characters).
- **Footer text** — the small attribution line at the bottom of the page (max 200 characters).

A live preview updates as you type. Click **Save changes** to apply immediately.

### API

**GET `/api/unsubscribe-page`**

Returns the current customization settings, or system defaults if none have been saved.

```json
{
  "object": "unsubscribe_page_settings",
  "logo_url": null,
  "brand_color": "#10b981",
  "headline": "Unsubscribed successfully",
  "message": "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
  "footer_text": "Powered by OpenSend"
}
```

**PUT `/api/unsubscribe-page`**

Upserts the settings. All fields are optional — omit a field to leave it unchanged.

```json
{
  "logo_url": "https://cdn.example.com/logo.png",
  "brand_color": "#6366f1",
  "headline": "You have been unsubscribed",
  "message": "We have removed you from our mailing list.",
  "footer_text": "Acme Corp"
}
```

Validation rules:
- `logo_url` must be an `http` or `https` URL, or `null` to clear the logo.
- `brand_color` must be a valid hex color string (`#rrggbb` or `#rrggbbaa`).
- `headline` max 200 characters, `message` max 1000 characters, `footer_text` max 200 characters.

## Unsubscribed contacts in your audience

Unsubscribed contacts remain in your audience with `unsubscribed: true`. You can:

- Filter contacts by unsubscribed status in the Contacts list.
- Export unsubscribed contacts via the dashboard export.
- Query the contacts API with `unsubscribed=true`.

Unsubscribed contacts are automatically excluded from broadcasts and automation email steps.
