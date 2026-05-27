# Docs QA Checklist

Use this checklist before merging documentation or compatibility-route work.

## Public docs safety

- Public docs are OpenSend-owned and do not send readers to competitor docs.
- Examples use `os_...` API keys, OpenSend hosts, and original payloads.
- Claims about hosted, self-hosted, SES, ingester, SDK, and dashboard behavior are grounded in implementation or explicitly marked as limitations.
- API reference pages are not just a title, endpoint, and auth block unless intentionally summary-only.

## Compatibility routes

- Root aliases are implemented before public docs lead with them.
- Dashboard route collisions still render dashboard pages for browser/RSC navigation.
- API-like requests with `Authorization`, `Accept: application/json`, or JSON bodies hit JSON routes.
- Alias routes share canonical auth, tenant, quota, and rate-limit behavior.
- Targeted middleware or route tests cover each new alias family.

## Required commands

```bash
bun run docs:generate
bun run docs:check
bun run typecheck
bun run lint
bunx vitest run tests/middleware-rate-limit.test.ts
```

Run broader `make check && make test` when source or test changes can affect more than the touched slice.
