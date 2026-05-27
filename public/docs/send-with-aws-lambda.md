# Send emails with AWS Lambda

AWS Lambda can send with either the TypeScript SDK or the REST API. Use environment variables or a secrets manager for the OpenSend API key.

## Environment variables

```bash
OPENSEND_API_KEY=os_your_api_key
OPENSEND_BASE_URL=https://opensend.namuh.co
```

Set `OPENSEND_BASE_URL` to your self-hosted app URL if you are not using OpenSend Cloud.

## TypeScript handler

```ts
import { Resend } from "opensend";

const resend = new Resend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

type Event = {
  email?: string;
};

export async function handler(event: Event) {
  if (!event.email) {
    return { statusCode: 400, body: JSON.stringify({ error: "email is required" }) };
  }

  const { data, error } = await resend.emails.send(
    {
      from: "OpenSend <onboarding@updates.example.com>",
      to: event.email,
      subject: "Hello from Lambda",
      html: "<p>AWS Lambda queued this email.</p>",
    },
    { idempotencyKey: `lambda-${event.email}` },
  );

  if (error) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({ error: error.message, code: error.code }),
    };
  }

  return { statusCode: 200, body: JSON.stringify({ id: data.id }) };
}
```

## Operational notes

- Initialize the SDK outside the handler so warm invocations reuse it.
- Use idempotency keys when Lambda is triggered by queues, EventBridge, or provider webhooks.
- If your Lambda runs in a VPC, make sure it has outbound HTTPS access to OpenSend.
- Prefer broadcasts for bulk audience sends; Lambda loops can accidentally exceed provider quotas.
