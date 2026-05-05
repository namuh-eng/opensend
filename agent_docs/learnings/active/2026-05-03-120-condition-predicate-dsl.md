---
date: 2026-05-03
issue: "#120"
type: decision
promoted_to: null
---

## Condition step predicate DSL stays intentionally small

**What:** The first condition-step backend slice accepts one predicate per step: `left` path, comparison `operator`, and optional literal `right` value. Paths are limited to `event.*`, `contact.*`, and `steps.<key>.output.*`; branch labels are stored on connections as optional `type` values.

**Why:** Issue #120 explicitly calls for simple comparisons instead of a broad expression language. Single-predicate steps keep validation, deterministic runner failures, and future UI mapping small while still allowing composition through multiple condition steps.

**Fix:** Extend the DSL only with focused tests and runner semantics; avoid adding expression-tree parsing or arbitrary code-like conditions without a new product decision.
