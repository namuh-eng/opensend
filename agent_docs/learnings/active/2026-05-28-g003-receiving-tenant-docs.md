---
date: 2026-05-28
issue: g003-receiving-inbound-parity
type: decision
promoted_to: null
---

# Receiving parity must distinguish read APIs from inbound ingestion

While documenting Resend-compatible receiving parity, the repo showed read APIs and `received_emails` storage but no automatic inbound MIME ingestion path that inserts rows or emits `email.received`. Public docs should say receiving ingestion is operator-owned until implemented instead of implying hosted parity.

The same audit found received email API reads were not passing API-key `userId` into the repository. Receiving read routes should require tenant-owned API keys and query `received_emails.user_id` for list, detail, and attachments; cross-tenant misses should remain indistinguishable from missing rows.
