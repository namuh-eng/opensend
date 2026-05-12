---
date: 2026-05-12
issue: "#464"
type: decision
promoted_to: null
---

## Keep the first Ruby SDK as a stdlib-only repo-local gem package

Issue #464 adds the first Ruby SDK slice in `packages/ruby-sdk` with the future
RubyGems package name `opensend`. The package intentionally uses only Ruby
stdlib (`net/http`, `json`, `uri`) so tests and local usage do not require
external registry credentials or additional runtime dependencies.

The first slice exposes `OpenSend.api_key`, `OpenSend.base_url`,
`OpenSend::Emails.send(...)`, `OpenSend::Client#emails.send(...)`, and a
migration-oriented `Resend` alias against the root `/emails` endpoint. Batch,
resource-wide SDK parity, and generated DTOs remain follow-up work.

RubyGems 3.0 in the local toolchain does not recognize `Elastic-2.0`, so the
gemspec uses `Nonstandard` with a `license_uri` pointing to the repository
LICENSE to keep `gem build` warning-free while preserving the project license
source.
