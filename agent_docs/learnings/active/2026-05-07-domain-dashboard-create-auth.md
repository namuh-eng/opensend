---
date: 2026-05-07
issue: "domain-create"
type: mistake
promoted_to: null
---

## Dashboard create routes must accept dashboard session auth

The domains dashboard page posted to `/api/domains` with same-origin session cookies, but `POST /api/domains` only accepted API-key auth while `GET/PATCH/DELETE/verify/auto-configure` accepted dashboard-or-API-key auth. The UI failed to add domains because the route returned 401 for dashboard users.

When a dashboard component calls an app API route without an Authorization header, the route must use the dashboard session authorization path (`authorizeDashboardOrApiKey` + `getServerSession`) and stamp the resulting session `user.id` on tenant-owned rows.
