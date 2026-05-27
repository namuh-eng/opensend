# Verify Webhook Requests

Verify every OpenSend webhook request before trusting the payload.

OpenSend signs the exact JSON request body with the webhook signing secret returned when the endpoint is created. The secret is shown once; store it outside source control.

## Headers

| Header | Description |
| --- | --- |
| `svix-id` | Delivery attempt ID. |
| `svix-timestamp` | Unix timestamp in seconds. Reject stale timestamps to reduce replay risk. |
| `svix-signature` | One or more signatures in `v1,<signature>` form. |

## Signature input

OpenSend signs this string:

```text
<svix-id>.<svix-timestamp>.<raw-request-body>
```

The signature is HMAC-SHA256 with the webhook secret after removing the optional `whsec_` prefix, encoded as base64, then prefixed with `v1,`.

## TypeScript example

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyOpenSendWebhook(input: {
  secret: string;
  id: string;
  timestamp: string;
  body: string;
  signatureHeader: string;
}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(input.timestamp)) > 5 * 60) {
    return false;
  }

  const secret = input.secret.replace(/^whsec_/, "");
  const expected = createHmac("sha256", secret)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest("base64");

  return input.signatureHeader
    .split(" ")
    .flatMap((part) => part.split(","))
    .some((part, index, parts) => {
      if (part !== "v1") return false;
      const candidate = parts[index + 1];
      if (!candidate) return false;
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
}
```

## Failure handling

Return a non-2xx status when verification fails. OpenSend treats non-2xx responses as failed attempts and schedules retries until the delivery reaches the configured retry limit.
