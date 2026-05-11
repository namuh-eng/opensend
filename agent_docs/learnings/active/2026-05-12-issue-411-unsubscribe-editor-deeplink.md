---
date: 2026-05-12
issue: "#411"
type: pattern
promoted_to: null
---

## Missing dashboard editor routes need both CTA removal and direct-route copy

When a dashboard CTA points at a feature that does not exist yet, fix both
surfaces: disable or remove the visible CTA with honest copy, and add a small
route-level unavailable page for the old/deep-linked URL. Only removing the CTA
leaves bookmarked or dogfood-discovered URLs as raw 404s; only adding the page
keeps advertising a non-working editor.

For the Topics unsubscribe editor, `/audience/topics` now disables the editor
controls and `/audience/topics/unsubscribe-page/edit` renders explanatory copy
with a path back to Topics.
