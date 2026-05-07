# Control-plane API service

`services/api` is the Bun + Hono skeleton for the future OpenSend/Namuh Send control-plane API runtime.

Local development convention:

```bash
bun run dev:api
# service listens on http://localhost:3026 by default
```

Current endpoints:

- `GET /healthz` — service/version health metadata
- `GET /readyz` — static readiness response that does not require AWS, database, queue, or other external credentials
- `POST /mcp` — Streamable HTTP-compatible JSON-RPC MCP endpoint for agent clients. Requires `Authorization: Bearer <opensend_api_key>` and forwards tool calls to the existing public OpenSend API (`OPENSEND_API_BASE_URL`, default `http://localhost:3015`).

This service is intentionally a skeleton. The existing Next.js route handlers under `src/app/api` remain the current public API until follow-up route-move/thin-adapter PRs move route ownership behind this boundary.

## Thin-adapter pilot pattern

The API keys route family is the first narrow thin-adapter pilot for issue #71:

- `src/app/api/api-keys/**/route.ts` owns only request authorization, JSON/query/route-param parsing, service invocation, and HTTP response mapping.
- `packages/core/src/services/apiKeys.ts` owns API-key business rules: pagination bounds, create validation, token generation/hash/preview construction, repository orchestration, not-found semantics, and cache-invalidation hook invocation.
- The service accepts explicit dependencies, so behavior can be unit-tested without a Next.js request object and later reused by the Hono control-plane runtime.

Follow-up route moves should preserve this split before adding Hono handlers: keep public API shape stable, move business logic into core or a service layer, then let each runtime provide only an adapter.


## MCP server slice

This workspace includes a private local `@opensend/mcp` package used by the control-plane service and by stdio clients. It intentionally exposes only the first parity slice backed by stable public API routes: send/list/get emails, create/list/get contacts, create/list/get domains, and create/list/get webhooks. Tool calls preserve the existing public API response or error body inside MCP `content[0].text` with `{ status, ok, body }`.

### Codex stdio setup

```bash
codex mcp add opensend \
  --env OPENSEND_API_KEY=os_... \
  --env OPENSEND_API_BASE_URL=http://localhost:3015 \
  -- bun /path/to/opensend/packages/mcp/src/stdio.ts
```

### JSON-config stdio setup

```json
{
  "mcpServers": {
    "opensend": {
      "command": "bun",
      "args": ["/path/to/opensend/packages/mcp/src/stdio.ts"],
      "env": {
        "OPENSEND_API_KEY": "os_...",
        "OPENSEND_API_BASE_URL": "http://localhost:3015"
      }
    }
  }
}
```

### Streamable HTTP setup

Run the control-plane API and point clients at `/mcp`:

```bash
OPENSEND_API_BASE_URL=http://localhost:3015 bun run dev:api
```

HTTP MCP clients must send their OpenSend API key per request:

```http
POST http://localhost:3026/mcp
Authorization: Bearer os_...
Content-Type: application/json

{"jsonrpc":"2.0","id":"tools","method":"tools/list"}
```

Deferred from this slice: received emails, broadcasts, segments, topics, contact properties, API-key management, and packaging/publishing ownership for a public `npx` command.
