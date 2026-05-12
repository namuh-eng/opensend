---
date: 2026-05-12
issue: "#450"
type: decision
promoted_to: null
---

## Template previews must reuse send variable resolution semantics

Issue #450 added `/api/templates/:id/preview` for dashboard preview rendering. The preview route intentionally calls `renderStoredTemplateContent` and the shared `resolveStoredTemplateRenderVariables` helper rather than implementing a dashboard-only renderer.

Production sends use `mode: "send"`, which fails missing required variables before queue/provider delivery. Dashboard previews use `mode: "preview"`, which labels fallback values and inserts sample values only for required variables so users can inspect the HTML/text output before send. Those preview samples are returned as diagnostics and must not be treated as production send defaults.

React Email templates remain registry-controlled through `templates.document.rendering.templateKey`; dashboard starter creation stores a safe registry key and variable metadata, not tenant-provided TSX/JS.
