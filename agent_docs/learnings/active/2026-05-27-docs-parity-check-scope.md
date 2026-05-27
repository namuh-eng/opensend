---
date: 2026-05-27
issue: resend-compatible-docs-parity
type: decision
promoted_to: null
---

# Scope docs quality checks to the parity slice until legacy stubs are expanded

During the Resend-compatible docs/parity slice, a repo-wide minimum word-count gate for every `public/docs/api-reference/**/*.md` page failed on many pre-existing sparse pages outside the touched alias families. Keep the new `tools/check-docs-quality.mjs` gate focused on the priority parity families changed in the slice (`contact-properties`, `domains`, `emails`, `logs`, `topics`, `webhooks`) until the older API key, broadcast, contact, event, segment, suppression, and template reference pages are intentionally expanded or marked summary-only.

Also keep local scrape artifacts excluded from tooling: `.venv-scrape` and `private-docs` should be ignored by Biome, and `private-docs/` is the restored local scrape folder name in `.gitignore`.
