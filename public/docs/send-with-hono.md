# Send emails with Hono

Hono runs on Bun, Node.js, Cloudflare Workers, and other Fetch-compatible runtimes. Choose the SDK for Node/Bun runtimes and the REST API for constrained edge runtimes.

## Node.js or Bun runtime

```bash
npm install hono opensend
```

```ts
import { Hono } from "hono";
import { Opensend } from "opensend";

const app = new Hono();

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

app.post("/send", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  if (!body.email) {
    return c.json({ error: "email is required" }, 400);
  }

  const { data, error } = await opensend.emails.send({
    from: "OpenSend <onboarding@updates.example.com>",
    to: body.email,
    subject: "Hello from Hono",
    html: "<p>Hono queued this email.</p>",
  });

  if (error) {
    return c.json({ error: error.message, code: error.code }, error.statusCode);
  }

  return c.json({ id: data.id });
});

export default app;
```

## Cloudflare Workers runtime

Cloudflare Workers should use direct REST calls. This avoids bundling optional Node dependencies and gives you explicit control over secrets.

```ts
import { Hono } from "hono";

type Env = {
  OPENSEND_API_KEY: string;
  OPENSEND_BASE_URL?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.post("/send", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email) return c.json({ error: "email is required" }, 400);

  const baseUrl = c.env.OPENSEND_BASE_URL ?? "https://opensend.namuh.co";
  const response = await fetch(`${baseUrl}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.OPENSEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "OpenSend <onboarding@updates.example.com>",
      to: email,
      subject: "Hello from Hono on Workers",
      html: "<p>Workers queued this email with OpenSend.</p>",
    }),
  });

  const json = await response.json();
  return c.json(json, response.status as 200 | 400 | 401 | 403 | 429 | 500);
});

export default app;
```

## Webhooks in Hono

Use `await c.req.text()` to preserve the raw body for signature verification before parsing JSON. OpenSend webhook deliveries include `svix-id`, `svix-timestamp`, and `svix-signature` headers.
