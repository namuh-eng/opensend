---
date: 2026-05-28
issue: "#552"
type: decision
promoted_to: null
---

## Receiving routing audit lives on received email route_decisions

Issue #552 models receiving route matches separately from any future forwarding/reply runtime. Route CRUD owns exact, alias, and catch-all records for verified receiving domains, while received email rows carry a `route_decisions` JSONB array so later inbound parser, forwarding, webhook, and log lanes can consume a stable audit shape without needing to replay routing state after routes change.

Keep forwarding delivery and threaded replies out of this layer. The matching precedence is exact address, alias, catch-all, then unrouteable; route decisions should be written at ingestion time, not inferred later from mutable route rows.
