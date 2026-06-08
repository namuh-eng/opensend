# Send emails with Railway

Railway can host application code that sends through OpenSend, and it can also host a self-hosted OpenSend deployment. This guide covers application code that calls an existing OpenSend API.

## Variables

Add these variables to your Railway service:

```bash
OPENSEND_API_KEY=os_your_api_key
OPENSEND_BASE_URL=https://opensend.namuh.co
```

If you self-host OpenSend on Railway, set `OPENSEND_BASE_URL` to your OpenSend app URL.

## Node.js service example

```ts
import { Opensend } from "opensend";

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

export async function sendWelcome(email: string) {
  const { data, error } = await opensend.emails.send({
    from: "OpenSend <onboarding@updates.example.com>",
    to: email,
    subject: "Welcome",
    html: "<p>Your Railway service queued this email.</p>",
  });

  if (error) throw new Error(error.message);
  return data.id;
}
```

## Self-hosted caveat

For a full self-hosted OpenSend stack, Railway must provide the same runtime dependencies described in [Self Hosting](./self-hosting.md): Postgres, the app, background delivery worker/ingester, AWS SES credentials, and DNS setup. A web app without the worker can accept email rows but will not complete delivery reliably.
