---
date: 2026-06-08
issue: null
type: decision
promoted_to: null
---

## API-key runtime generation now uses the OpenSend prefix

Runtime-created API keys should use `os_...` from `packages/core/src/services/apiKeys.ts`. The older issue #427 boundary intentionally left runtime generation as `re_...` while docs/examples moved to `os_...`; that boundary is superseded for newly created keys.

Existing `re_...` keys remain valid because API-key auth hashes the full raw token and performs a database lookup without prefix enforcement.
