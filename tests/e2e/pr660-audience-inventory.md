# PR 660 Audience Inventory

This inventory documents the acceptance criteria and finite risk-based edge cases
covered by `pr660-audience-inventory.spec.ts`. The scenario uses sanitized local
Postgres rows, Better Auth dashboard cookies, and real Next.js routes.

## Local Data Contract

- Tenant A has 45 contacts, 8 segments, 6 topics, and 6 contact properties.
- Tenant B has a same-run contact that must not appear in Tenant A's dashboard.
- Seeded contacts include subscribed and unsubscribed states, segment names,
  topic subscriptions, and custom properties with no production data.

## Acceptance Criteria

- Contacts: tenant-scoped stats show all, subscribed, and unsubscribed counts for
  the signed-in dashboard user only.
- Contacts: search, segment filter, subscription filter, export button, row menu,
  cursor pagination, detail navigation, edit, delete cancel, and delete confirm
  are reachable as a dashboard user.
- Segments: list rows, create modal, export button, filtered contacts link, row
  menu, and delete cancel are reachable.
- Properties: search input, type selector, create modal fields, row menu, and
  delete cancel are reachable.
- Topics: default-subscription selector, unsubscribe-page preview/link, create
  modal fields, row menu, and delete cancel are reachable.
- Dashboard shell: the audience page must not create page-level horizontal
  overflow at 375, 768, or 1280 pixel browser widths; wide tables may scroll
  inside their own container.

## Risk-Based Edge Cases

- Tenant isolation: dashboard stats and contact search must exclude another
  tenant's rows.
- Auth contract: dashboard callers must use Better Auth sessions; API-key callers
  still require full-access permissions.
- Identifier handling: contact detail actions must accept real UUID contact IDs
  and not misclassify them as email identifiers.
- Pagination: moving forward and backward must use cursor state rather than a
  fake total count.
- Filtering: changing search, status, or segment resets cursor pagination.
- Property filters: search must match key or display name, and type must apply
  server-side.
- Destructive controls: cancel paths must close dialogs without deleting rows;
  delete confirm is proven on a seeded contact with a direct DB assertion.
- Browser stability: the inventory fails on uncaught page errors.
