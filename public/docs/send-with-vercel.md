# Send emails with Vercel

Use OpenSend from Vercel Serverless Functions, Next.js Route Handlers, or Server Actions. Keep the API key in Vercel project environment variables.

## Environment variables

Set these in the Vercel dashboard or with the Vercel CLI:

```bash
OPENSEND_API_KEY=os_your_api_key
OPENSEND_BASE_URL=https://opensend.namuh.co
```

Use your self-hosted OpenSend origin for `OPENSEND_BASE_URL` only when applicable.

## Next.js on Vercel

The [Next.js guide](./send-with-nextjs.md) is the recommended starting point. It keeps OpenSend calls in server-only code and returns only the queued email ID to the browser.

## Standalone serverless function

```ts
import { Opensend } from "opensend";

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const { data, error } = await opensend.emails.send({
    from: "OpenSend <onboarding@updates.example.com>",
    to: email,
    subject: "Hello from Vercel",
    html: "<p>Vercel queued this email with OpenSend.</p>",
  });

  if (error) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }

  return Response.json({ id: data.id });
}
```

## Notes

- Do not expose the key with `NEXT_PUBLIC_`.
- Use `runtime = "nodejs"` when rendering React Email components or importing Node-only dependencies.
- Vercel may retry failed invocations depending on the trigger; use idempotency keys for duplicate-sensitive sends.
