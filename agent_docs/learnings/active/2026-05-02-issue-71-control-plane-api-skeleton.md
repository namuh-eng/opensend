---
date: 2026-05-02
issue: "#71"
type: decision
promoted_to: null
---

## Control-plane API skeleton boundary

**What:** Introduced `services/api` as a Bun + Hono workspace with only `/healthz` and `/readyz` endpoints on local port 3026.
**Why:** Issue #71 needs an independently discoverable control-plane runtime before moving route ownership, but this slice must not change existing Next.js API behavior or depend on the OpenSend package namespace rename.
**Fix:** Keep `src/app/api` as the current public API until follow-up thin-adapter PRs move route logic behind the control-plane boundary.
