---
date: 2026-05-28
issue: g005-sdk-framework-docs
type: decision
promoted_to: null
---

# SDK framework docs must separate package support from runtime support

OpenSend has first-party TypeScript, Python, Go, and Ruby SDK packages plus an SMTP relay, but not every runtime should import an SDK. Cloudflare Workers/edge examples should use the REST API with `fetch` and documented OpenSend headers instead of implying Node-compatible package support.

Python and Ruby public docs should also say local repository install until PyPI/RubyGems publishing is complete. Go public docs should use the package README's current `v0.2.0` module tag instead of stale `v0.1.0` examples.
