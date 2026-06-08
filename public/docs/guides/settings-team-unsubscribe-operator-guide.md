# Settings, Team, and Unsubscribe Page Operator Guide

Use this guide to understand which settings surfaces are live in the current OpenSend dashboard and which are intentionally unavailable or deployment-gated.

## Settings overview

The **Settings** page includes tabs for Usage, SMTP, Team, Unsubscribe Page, Billing when enabled, and Documents.

| Area | Current behavior |
| --- | --- |
| Usage | Shows transactional, marketing, and team quota counters. It falls back to Free-plan defaults if usage data cannot load. |
| SMTP | Shows SMTP host, port, and username only when `SMTP_HOST`, `SMTP_PORT`, and `SMTP_USER` are configured. The SMTP password is your OpenSend API key. |
| Team | Lists workspace members and pending invitations. Owners can invite, revoke pending invitations, change admin/member roles, and remove other members. |
| Unsubscribe Page | Shows a preview-only card in Settings. Live editing is available from the Topics unsubscribe-page editor. |
| Billing | Only appears when billing is enabled for the deployment. Plan checkout and customer portal actions are unavailable until billing is configured. |
| Documents | Some documents are downloadable; unavailable documents are labeled instead of linked. |

## Team management

The Team tab uses OpenSend workspace membership tables. Owners can invite teammates as **Member** or **Admin**, copy the one-time manual invitation token, revoke pending invitations, change another member between Member/Admin, and remove another member.

Invitation email delivery is not automatic in this MVP. The dashboard returns a manual token once; self-hosted operators should share it through their own secure channel. The invited user accepts from **Settings → Team** while signed in with the invited email address.

Admins and members can view team state but cannot invite, revoke, edit roles, or remove members. Owner assignment, ownership transfer, and owner self-removal remain unavailable.

## Billing and usage

Hosted or self-hosted deployments can disable billing. When billing is disabled:

- The Settings page does not show the Billing tab.
- `/settings/billing` explains that plan management and checkout are unavailable.
- Upgrade buttons in usage surfaces are disabled with explanatory copy.

When billing is enabled, `/settings/billing` loads the current plan, subscription period, and usage summary. `/settings/billing/plans` shows the plan chooser.

## SMTP settings

The SMTP tab is deployment-configured. If `SMTP_HOST`, `SMTP_PORT`, and `SMTP_USER` are present, the dashboard displays copyable SMTP connection settings. If any are missing, the tab shows that SMTP is not configured for this installation.

## Unsubscribe page customization

There are two dashboard surfaces with different roles:

- **Settings → Unsubscribe Page**: preview-only card for the generic confirmation experience.
- **Audience → Topics → Unsubscribe page customization**: live editor that loads and saves tenant unsubscribe-page settings through `/api/unsubscribe-page`.

The live editor supports:

- Logo URL, limited to HTTP(S) URLs.
- Brand color as `#rrggbb` or `#rrggbbaa`.
- Headline up to 200 characters.
- Message up to 1,000 characters.
- Footer text up to 200 characters.

Saved settings apply to hosted unsubscribe links after the public route verifies the signed token and marks the contact unsubscribed.

## Unavailable or partial behavior to expect

- Automatic team invitation email delivery: unavailable; use the manual token path.
- Owner assignment, ownership transfer, and owner self-removal: unavailable.
- Self-service billing: deployment-gated.
- Dedicated IP pools: plan-gated and managed through API/domain assignment surfaces where enabled.
- Settings-tab unsubscribe preview editing: unavailable; use the Topics editor for live settings.
- Public retention controls for webhook delivery records: unavailable in this guide pack.

Labeling these boundaries is intentional. Operators should not assume unavailable owner-transfer or automatic-delivery behavior exists unless the backing route, tenant isolation, audit events, and tests have shipped.
