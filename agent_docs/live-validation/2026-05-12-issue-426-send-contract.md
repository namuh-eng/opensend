# Issue #426 live send-contract validation evidence

Date: 2026-05-12
Base: `origin/staging` at `dedfd9d9607ee8f7298fc8593e4a7c17557b3355`
Deployed origins tested:

- `https://opensend.namuh.co`
- `https://api.opensend.namuh.co`

Discovery notes:

- Repo SDK/docs still mention `https://api.opensend.com`, but the ECS app service currently routes through the `opensend.namuh.co` / `api.opensend.namuh.co` host-header rules.
- Local repo/env inspection found no deployed OpenSend API key and no configured safe recipient. ECS task configuration exposes only app/service secrets such as database/auth/provider config; no reusable test API key or safe test recipient was present. All credential-dependent checks are therefore blocked rather than guessed.

## Checks completed without credentials

Requests used a harmless JSON body with placeholder `example.com` addresses and no authorization header.

| Check | Origin | Result |
|---|---|---|
| Missing auth on root `POST /emails` | `https://opensend.namuh.co` | `401`, `content-type: application/json;charset=utf-8`, body `{ "name": "missing_api_key", "code": "missing_api_key", "message": "Missing API key. Provide an Authorization: Bearer <api_key> header.", "statusCode": 401 }`; no redirect. |
| Missing auth on canonical `POST /api/emails` control | `https://opensend.namuh.co` | Same `401` JSON API auth envelope; no redirect. |
| Dashboard `GET /emails` | `https://opensend.namuh.co` | `307` with `location: /auth`, body `/auth`; confirms page/auth flow remains separate from JSON POST alias. |
| Missing auth on root `POST /emails` | `https://api.opensend.namuh.co` | Same `401` JSON API auth envelope; no redirect. |
| Missing auth on canonical `POST /api/emails` control | `https://api.opensend.namuh.co` | Same `401` JSON API auth envelope; no redirect. |
| Dashboard `GET /emails` | `https://api.opensend.namuh.co` | `307` with `location: /auth`, body `/auth`; confirms page/auth flow remains separate from JSON POST alias. |

## Blocked checks

These acceptance checks require a deployed OpenSend API key plus a configured safe recipient/sender and were not executed:

1. Valid minimal `POST /emails` returns exactly `{ id }`.
2. 256-character `Idempotency-Key` is accepted.
3. 257-character `Idempotency-Key` is rejected.
4. Duplicate single-send idempotency retry replays the original `{ id }` without duplicate send side effects where observable.
5. Optional request fields: string/array recipients, `cc`, `bcc`, `reply_to`, `tags`, `scheduled_at`, and safe attachment metadata.

Exact missing dependency: a staging/deployed OpenSend API key with permission to send only to a safe verified test recipient/sender pair. Do not close #426 until those checks are run or the issue is explicitly narrowed to unauthenticated alias validation only.
