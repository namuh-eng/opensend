---
date: 2026-05-07
issue: "#243"
type: pattern
promoted_to: null
---

## Preserve public validation envelopes while adding nested field paths

**What:** Issue #243 keeps the existing `validation_error` envelope and top-level Zod `fieldErrors`, but augments validation details with dotted nested paths such as `tags.0.name` and `1.tags.0.value` for array item failures.

**Why:** Single and batch send clients need stable tag-specific paths without breaking existing consumers that already inspect top-level keys like `to`, `subject`, `scheduled_at`, or `tags`.

**Pattern:** Add nested issue paths only when the Zod issue path has at least two segments; otherwise keep `flattenError` output authoritative to avoid duplicate top-level messages.
