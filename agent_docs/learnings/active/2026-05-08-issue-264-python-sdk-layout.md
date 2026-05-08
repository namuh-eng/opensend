---
date: 2026-05-08
issue: "#264"
type: decision
promoted_to: null
---

## Keep the first Python SDK as a repo-local `packages/python-sdk` package

Issue #264 adds a first-party Python package in `packages/python-sdk` with the PyPI distribution/import name `opensend`. This keeps it alongside the TypeScript SDK without adding a Bun workspace package or changing app runtime inputs.

The first slice deliberately implements only module-level `opensend.api_key` + `opensend.Emails.send/send_batch` and instance `OpenSend`/`Resend` clients against root `/emails` aliases. Async and non-email resources stay out of scope until a follow-up parity issue, avoiding duplicated DTO drift before OpenAPI generation exists.
