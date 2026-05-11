---
date: 2026-05-11
issue: "#388"
type: decision
promoted_to: null
---

## Public status page exposes coarse readiness, not raw infrastructure details

Issue #388's first public status slice should aggregate existing health probes and optional deployment wiring into coarse component states. Keep `/api/health` unchanged as the raw app health probe, and expose `/api/status` as the sanitized public shape.

Optional dependencies such as the ingester health URL and background queue should render as `unknown`/not configured when unwired instead of being treated as fully operational. Failed probes should degrade/outage components without leaking hostnames, connection strings, or provider error text.

Incident history currently uses a documented empty in-repo source (`No incidents`) so future incident-store work can replace the source without changing the public page/API shape.
