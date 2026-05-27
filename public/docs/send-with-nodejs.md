# Send emails with Node.js

Use the TypeScript SDK from Node.js server code. This guide works for plain Node services, background workers, queues, and CLIs.

## Install

```bash
npm install opensend
```

Node 18 or newer is recommended because the SDK uses the built-in `fetch` API.

## Configure

```bash
export OPENSEND_API_KEY="os_your_api_key"
# Optional for self-hosted deployments:
export OPENSEND_BASE_URL="http://localhost:3015"
```

Do not prefix the key with `NEXT_PUBLIC_`, `VITE_`, or any client-side exposure prefix. The key must stay server-side.

## Send one email

```ts
import { Resend } from "opensend";

const resend = new Resend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

const { data, error } = await resend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: ["user@example.com"],
  subject: "Hello from Node.js",
  html: "<p>This message was queued by OpenSend.</p>",
  text: "This message was queued by OpenSend.",
});

if (error) {
  console.error(error.statusCode, error.code, error.message);
  process.exitCode = 1;
} else {
  console.log("queued", data.id);
}
```

When `OPENSEND_BASE_URL` is absent, the SDK targets OpenSend Cloud at `https://opensend.namuh.co`.

## Idempotent sends

Use an idempotency key when a worker may retry after a timeout or crash. OpenSend stores idempotency decisions for 24 hours.

```ts
await resend.emails.send(
  {
    from: "OpenSend <onboarding@updates.example.com>",
    to: "user@example.com",
    subject: "Receipt",
    html: "<p>Thanks for your purchase.</p>",
  },
  { idempotencyKey: `receipt-${orderId}` },
);
```

## React Email rendering

For React email components, install React and ReactDOM. The SDK renders the component to HTML locally before calling the API.

```bash
npm install opensend react react-dom @react-email/components
```

```tsx
import { Html, Text } from "@react-email/components";
import { Resend } from "opensend";

function WelcomeEmail({ name }: { name: string }) {
  return (
    <Html>
      <Text>Hello {name}, welcome to OpenSend.</Text>
    </Html>
  );
}

const resend = new Resend(process.env.OPENSEND_API_KEY);

await resend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: "user@example.com",
  subject: "Welcome",
  react: <WelcomeEmail name="Ada" />,
});
```

If `react-dom/server` is missing or rendering throws, the SDK returns a `react_render_error` and does not call the API.

## Batch sends

```ts
const { data, error } = await resend.emails.sendBatch([
  {
    from: "OpenSend <onboarding@updates.example.com>",
    to: "a@example.com",
    subject: "Hello A",
    html: "<p>A</p>",
  },
  {
    from: "OpenSend <onboarding@updates.example.com>",
    to: "b@example.com",
    subject: "Hello B",
    html: "<p>B</p>",
  },
]);

if (error) throw new Error(error.message);
console.log(data.data.map((item) => item.id));
```

For large marketing sends, prefer broadcasts and segments instead of hand-rolling loops in application code.
