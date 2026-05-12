---
date: 2026-05-12
issue: "#449"
type: decision
promoted_to: null
---

## Stored template render mode metadata stays in `templates.document.rendering`

Issue #449 wires send flows to the shared core template renderer without adding template schema columns. React Email-backed stored templates are selected by repo-owned registry metadata in `templates.document.rendering`, using the safe renderer input shape `{ kind: "react_email", templateKey: "..." }`.

Legacy templates remain the default when render metadata is absent. Unknown React Email keys and missing keys are converted to automation run failures or public API validation errors before queue/provider delivery, rather than evaluating tenant-provided JSX/TS/JS strings or crashing the send path.
