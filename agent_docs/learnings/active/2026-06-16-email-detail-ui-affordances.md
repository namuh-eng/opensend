---
date: 2026-06-16
issue: email-detail-ui-affordances
type: decision
promoted_to: null
---

## Plain-text email detail pages should not render blank previews

Text-only sends are valid: `/api/emails` accepts `text` without `html`, and the send path stores an empty HTML body with the plain text body. The dashboard email detail Preview tab should therefore fall back to a readable plain-text preview instead of rendering an empty HTML iframe.

Email list rows should make navigation obvious: use the subject as the primary detail link, allow row clicks to open the detail page, and avoid displaying inert overflow menus unless they are wired to concrete actions.
