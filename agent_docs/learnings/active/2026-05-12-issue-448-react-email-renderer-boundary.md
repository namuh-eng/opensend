---
date: 2026-05-12
issue: "#448"
type: decision
promoted_to: null
---

## React Email renderer boundary is registry-only in core

Issue #448 adds `packages/core/src/services/template-renderer.ts` as the first React Email adoption slice. The boundary preserves legacy stored-template interpolation for `subject`/`html`/`text` and exposes a separate React Email path backed only by repo-owned registry keys such as `demo-welcome`.

Do not evaluate tenant-provided TSX/JS/JSX strings. Future integrations should persist or pass a controlled `templateKey`/safe data representation, reject unknown keys with `TemplateRendererError`, and leave send-flow replacement to the follow-up integration issue.
