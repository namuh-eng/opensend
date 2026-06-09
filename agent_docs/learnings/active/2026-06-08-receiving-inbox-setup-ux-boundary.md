---
date: 2026-06-08
issue: receiving-inbox-setup-ux-boundary
type: decision
promoted_to: null
---

# Receiving UI should lead with stored mail, then setup

The dashboard `Emails > Receiving` mental model should start with received mail
rows from `received_emails`. Domain receiving routes, catch-all rules, and
forwarding controls are setup/configuration for the inbox, not the primary
content of the page.

Keep local mock inbox/config data development-only and clearly labeled. The real
dashboard route should still fetch tenant-scoped `received_emails`, domains,
routes, and forwarding rules, while the dev preview route can render the same
component with empty props and `useDemoData` for fast visual review.
