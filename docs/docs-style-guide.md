# OpenSend Docs Style Guide

OpenSend docs are a first-party product surface. They should help developers ship email safely while reflecting how OpenSend is implemented: self-hostable, SES-backed, operator-friendly, and compatible with common email API expectations.

## Source rules

- Treat competitor documentation as an internal coverage checklist only.
- Do not copy prose, examples, comments, screenshots, diagrams, information architecture, or distinctive layout from another product.
- Write examples with OpenSend-owned identifiers such as `os_YOUR_API_KEY`, `https://opensend.namuh.co`, and self-hosted `OPENSEND_BASE_URL` alternatives.
- Verify claims against code, tests, OpenAPI output, or first-party operations docs before publishing.
- Do not add public outbound links to competitor docs from `public/docs`.

## Voice and positioning

- Lead with OpenSend behavior, not another vendor's framing.
- Prefer concise operator language: deployment mode, tenant/auth boundary, queue/provider caveat, retry behavior, and failure mode.
- Call out self-hosting, AWS SES, Docker, Cloudflare, and ingester details when they materially affect setup or behavior.
- Be explicit when a capability is hosted-only, operator-only, partially supported, or not yet supported.

## API reference template

Each public API reference page should include:

1. Purpose: one short paragraph describing what the endpoint does.
2. Endpoint: method and public path. Prefer implemented root compatibility aliases; mention canonical `/api/*` paths only as compatibility notes when useful.
3. Authentication: API key header and a reminder that dashboard sessions are not API credentials.
4. Parameters: path, query, and body fields with required/optional status.
5. Examples: original OpenSend `curl` or SDK snippets with non-production placeholder values.
6. Responses: representative success payloads and important fields.
7. Errors: common status codes and how to recover.
8. Self-host notes: provider, rate-limit, queue, storage, or DNS setup caveats.

## Review checklist

- The page is truthful for the current code path.
- Public examples use OpenSend names, hosts, keys, and payloads.
- Endpoint paths match implemented routes and middleware aliases.
- The page avoids copied phrasing and vendor-specific structure.
- `public/docs/llms.txt` is regenerated after public docs changes.
