---
date: 2026-05-07
issue: "#250"
type: pattern
promoted_to: null
---

## Queued email delivery uses the core provider, not the app SES helper

OpenSend's public send routes persist email rows and enqueue `email.send`; the ingester worker then calls `emailProvider` from `@opensend/core`. Attachment MIME changes that only touch `src/lib/ses.ts` cover app-domain SES helpers and tests, but queued production delivery also needs matching support in `packages/core/src/services/emailProvider.ts` plus worker-side normalization/resolution in `packages/ingester/src/queue-worker.ts`.

When changing send-provider behavior, verify both the app helper and the core provider/worker path so accepted API payloads are actually delivered after queueing.
