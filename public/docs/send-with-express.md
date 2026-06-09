# Send emails with Express

Use the TypeScript SDK from Express route handlers. Initialize the client once and keep API keys in environment variables.

## Install

```bash
npm install express opensend
npm install --save-dev @types/express typescript tsx
```

## Configure

```bash
export OPENSEND_API_KEY="os_your_api_key"
# Optional for self-hosted deployments:
export OPENSEND_BASE_URL="http://localhost:3015"
```

## Route example

```ts
import express from "express";
import { Opensend } from "opensend";

const app = express();
app.use(express.json());

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});

type SendBody = {
  email?: string;
};

app.post("/send", async (req, res) => {
  const { email } = req.body as SendBody;
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const { data, error } = await opensend.emails.send({
    from: "OpenSend <onboarding@updates.example.com>",
    to: email,
    subject: "Hello from Express",
    html: "<p>Your Express API queued this message.</p>",
  });

  if (error) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }

  res.json({ id: data.id });
});

app.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});
```

## Webhook receiver

OpenSend webhook signatures are computed over the raw request body. If you receive webhooks in the same Express app, mount a raw-body route before `express.json()` for that path.

```ts
import express from "express";

const app = express();

app.post(
  "/webhooks/opensend",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const svixId = req.header("svix-id");
    const svixTimestamp = req.header("svix-timestamp");
    const svixSignature = req.header("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      res.status(400).send("missing signature headers");
      return;
    }

    // Verify the HMAC before parsing req.body as JSON.
    res.status(204).send();
  },
);

app.use(express.json());
```

See [Verify webhook requests](./webhooks/verify-webhooks-requests.md) for the signing algorithm.

## Retry safety

When Express receives a duplicate upstream request, use idempotency keys:

```ts
await opensend.emails.send(payload, {
  idempotencyKey: `signup-${userId}`,
});
```
