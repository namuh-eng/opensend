---
date: 2026-06-19
issue: "#643"
type: decision
promoted_to: null
---

## Migration verifier v1 must fail closed and stay dry-run only

For the `migrate-from-resend` verifier, keep the first in-tree CLI as a private
proof/reporting package rather than a publisher-ready migration platform.

Guardrails that mattered:
- Require an explicit target directory so the CLI cannot accidentally scan its
  own package and produce a credible but irrelevant report.
- Require an explicit `--base-url`/`OPENSEND_BASE_URL` for sandbox request
  planning; do not default planned requests to a hosted URL.
- Keep sandbox mode as request planning only. No fetch, no live sends, and no
  customer-resource mutations in v1.
- Preserve unknown findings even when a known Resend call appears on the same
  line; detection completeness is more important than report neatness.

Future scanner improvements can add AST-backed detection, but the v1 regex
scanner should stay honest with `partial`, `unsupported`, and `unknown` statuses
plus report caveats.
