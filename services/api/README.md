# Control-plane API service

`services/api` is the Bun + Hono control-plane API runtime for route families that have been moved out of Next.js ownership.

Use your OpenSend API key (`os_...`) with the Resend-compatible API surface.

Local development convention:

```bash
bun run dev:api
# service listens on http://localhost:3026 by default
```

Current endpoints:

- `POST /emails` — transactional send API. Uses the shared send implementation that also backs the compatibility Next.js adapter at `POST /api/emails`; preserves OpenSend/Resend-compatible auth, validation, idempotency, queueing, response, and error shapes.
- `POST /emails/batch` — transactional batch send API with the same shared behavior as `POST /api/emails/batch`.
- `GET /healthz` — service/version health metadata
- `GET /readyz` — static readiness response that does not require AWS, database, queue, or other external credentials
- `POST /mcp` — Streamable HTTP-compatible JSON-RPC MCP endpoint for agent clients. Requires `Authorization: Bearer <opensend_api_key>` and forwards tool calls to the existing public OpenSend API (`OPENSEND_API_BASE_URL`, default `http://localhost:3015`).

The transactional send route family is now owned by shared send handlers consumed by this Hono service. The existing Next.js handlers remain compatibility adapters for the current public `/api/emails` URLs; no production routing cutover is implied by local service ownership.

### Transactional send local testing

Start the Hono service on the default port:

```bash
bun run dev:api
# http://localhost:3026
```

Exercise the service route with an OpenSend API key:

```bash
bun -e 'const r = await fetch("http://localhost:3026/emails", { method: "POST", headers: { "authorization": "Bearer os_...", "content-type": "application/json" }, body: JSON.stringify({ from: "sender@example.com", to: "recipient@example.com", subject: "Hello", html: "<p>Hello</p>" }) }); console.log(r.status, await r.text())'
```

Focused tests for this route family live in `tests/api-emails.test.ts` and cover both the Hono service routes and the Next.js compatibility adapters:

```bash
bun run test -- tests/api-emails.test.ts
```


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
