---
date: 2026-05-10
issue: "#289"
type: decision
promoted_to: null
---

## Custom event schemas use a narrow JSON-Schema-like object dialect

**What:** Stored custom event schemas are validated as root object descriptors with optional `properties` and `required` keys. Property descriptors support only `string`, `number`, `boolean`, `object`, and `array`; extra event payload fields remain allowed.

**Why:** The database only stored schema JSONB without an established dialect. A small in-house contract avoids a broad JSON Schema dependency while still proving send-time payload validation and useful field-path errors.

**Fix:** Extend this dialect only with focused tests and documentation, or switch to a full JSON Schema validator in a separate PR that justifies the dependency/API tradeoff.
