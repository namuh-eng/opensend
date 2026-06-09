# Send emails with Bun

Bun projects can use the same `opensend` TypeScript SDK as Node.js projects. This is useful for Bun APIs, queue workers, scripts, and the OpenSend monorepo itself.

## Install

```bash
bun add opensend
```

## Configure

```bash
export OPENSEND_API_KEY="os_your_api_key"
# Optional for self-hosted deployments:
export OPENSEND_BASE_URL="http://localhost:3015"
```

## Send from a Bun script

Create `send.ts`:

```ts
import { Opensend } from "opensend";

const opensend = new Opensend(Bun.env.OPENSEND_API_KEY, {
  baseUrl: Bun.env.OPENSEND_BASE_URL,
});

const { data, error } = await opensend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: "user@example.com",
  subject: "Hello from Bun",
  html: "<p>Bun queued this email with OpenSend.</p>",
});

if (error) {
  console.error(error.statusCode, error.message);
  process.exit(1);
}

console.log(data.id);
```

Run it:

```bash
bun run send.ts
```

## Bun HTTP server

```ts
import { Opensend } from "opensend";

const opensend = new Opensend(Bun.env.OPENSEND_API_KEY, {
  baseUrl: Bun.env.OPENSEND_BASE_URL,
});

Bun.serve({
  port: 3000,
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { email } = (await request.json()) as { email?: string };
    if (!email) {
      return Response.json({ error: "email is required" }, { status: 400 });
    }

    const { data, error } = await opensend.emails.send({
      from: "OpenSend <onboarding@updates.example.com>",
      to: email,
      subject: "Welcome",
      html: "<p>Thanks for signing up.</p>",
    });

    if (error) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    return Response.json({ id: data.id });
  },
});
```

## Production notes

- Initialize the client once at module scope and reuse it.
- Use idempotency keys for retrying jobs.
- Keep `OPENSEND_API_KEY` in your process environment or secret manager, not in front-end bundles.
- Set `OPENSEND_BASE_URL` only for self-hosted OpenSend deployments.
