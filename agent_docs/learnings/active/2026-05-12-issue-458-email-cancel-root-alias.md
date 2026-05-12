---
date: 2026-05-12
issue: "#458"
type: decision
promoted_to: null
---

## Root cancel alias delegates errors but normalizes success

Issue #458 adds Resend-compatible `POST /emails/:email_id/cancel` while preserving the existing internal `POST /api/emails/:id/cancel` response. The root route calls the internal cancel route with the remapped param so it keeps the same API-key auth, full-access permission, tenant-scoped lifecycle service call, and invalid-state/not-found behavior. Only a successful response is normalized to Resend's public `{ object: "email", id }` body, leaving the internal `/api` success body with `status: "canceled"` intact for existing callers.

The root cancel path also needs an explicit middleware API-alias bypass. Without `isEmailCancelAlias`, unauthenticated API clients would hit dashboard session redirect logic before the route can return API-key auth errors.
