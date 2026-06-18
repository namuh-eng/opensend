---
date: 2026-05-28
issue: 551
type: decision
promoted_to: null
---

# Inbound MIME ingestion belongs behind the standalone ingester boundary

Issue #551 adds `POST /events/inbound` to the Bun/Hono ingester rather than a Next.js route. The route persists a sanitized provider-event row first, parses raw MIME, resolves receiving routes to exactly one tenant, stores attachment bodies through the shared storage abstraction, inserts `received_emails`, and only then writes an internal durable `email_events.type = received` row.

Provider retries are idempotent by provider + event id and record duplicate attempts as `duplicate_provider_event` without duplicating received emails or attachments. Keep forwarding, reply threading, and public `email.received` webhook subscription behavior out of this foundation unless a later issue adds those runtime transitions.
