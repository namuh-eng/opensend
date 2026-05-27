# Send emails with Cloudflare Workers

Cloudflare Workers should use the OpenSend REST API with `fetch`. This keeps the bundle small, avoids optional Node dependencies, and works in the Workers runtime.

## Secrets

Store your API key as a Worker secret:

```bash
wrangler secret put OPENSEND_API_KEY
```

For self-hosted deployments, add a plain variable or secret named `OPENSEND_BASE_URL`. If it is not set, use OpenSend Cloud:

```txt
https://opensend.namuh.co
```

## Worker example

```ts
type Env = {
  OPENSEND_API_KEY: string;
  OPENSEND_BASE_URL?: string;
};

type SendRequest = {
  email?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = (await request.json()) as SendRequest;
    if (!body.email) {
      return Response.json({ error: "email is required" }, { status: 400 });
    }

    const baseUrl = env.OPENSEND_BASE_URL ?? "https://opensend.namuh.co";
    const response = await fetch(`${baseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENSEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `signup-${body.email}`,
      },
      body: JSON.stringify({
        from: "OpenSend <onboarding@updates.example.com>",
        to: body.email,
        subject: "Hello from Workers",
        html: "<p>Cloudflare Workers queued this email.</p>",
      }),
    });

    const json = await response.json();
    return Response.json(json, { status: response.status });
  },
};
```

## Notes

- Do not expose `OPENSEND_API_KEY` to browser code.
- Use `Idempotency-Key` for signup, checkout, and webhook-triggered sends that may retry.
- Use the REST API for Workers even if your local Node project uses the TypeScript SDK.
- Verify webhook requests with the raw request body before calling `request.json()`.
