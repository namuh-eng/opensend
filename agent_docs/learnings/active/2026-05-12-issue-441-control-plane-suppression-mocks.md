---
date: 2026-05-12
issue: 441
type: pattern
promoted_to: null
---

# services/api route additions must satisfy all createApp mocks

Adding a new statically registered `services/api` route imports its shared handler whenever `createApp()` is imported, even if a focused test only exercises `/emails` or `/webhooks`. Tests that mock `@opensend/core` for existing Hono route families must include the new service exports used by the added handler, or unrelated Hono parity suites fail at module import time before their route under test runs.
