---
date: 2026-05-19
issue: docs-refresh
type: decision
promoted_to: null
---

# Render human docs on pretty routes while preserving raw markdown

Public markdown stays under `public/docs/**/*.md` for the first-party LLM corpus and `/docs/llms.txt`. Because those `.md` files are static public assets, the human docs shell should link to pretty routes like `/docs/self-hosting` and `/docs/api-reference/introduction`, while exposing a `Raw markdown` link back to `/docs/self-hosting.md` for agents and users who want source text.

The docs shell reads the public markdown corpus, builds sidebar navigation and table-of-contents data, and renders styled markdown without adding an MDX dependency. When adding docs links in app UI, prefer the pretty route for humans unless the target is explicitly the raw LLM corpus.
