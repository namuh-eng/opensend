# Official SDKs

OpenSend ships first-party SDK packages for application code and keeps `/openapi.json` available for generated clients.

## TypeScript and JavaScript

Install the npm package:

```bash
npm install opensend
```

Send an email:

```ts
import { Resend } from "opensend";

const resend = new Resend(process.env.OPENSEND_API_KEY);

await resend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: ["user@example.com"],
  subject: "Hello from OpenSend",
  html: "<strong>It works.</strong>",
});
```

The TypeScript SDK intentionally exposes a familiar `Resend` client shape for migration-oriented integrations while targeting OpenSend's hosted or self-hosted base URL.

## Python

Use the Python SDK package when publishing credentials are configured for your environment. Keep the API key in `OPENSEND_API_KEY`, not in source code.

```py
from opensend import OpenSend

client = OpenSend(api_key=os.environ["OPENSEND_API_KEY"])
client.emails.send(
    from_="OpenSend <onboarding@updates.example.com>",
    to=["user@example.com"],
    subject="Hello from OpenSend",
    html="<strong>It works.</strong>",
)
```

## Go

The Go SDK is available from this repository module:

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.1.0
```

## Ruby

Use the Ruby SDK package for Ruby and Rails applications once RubyGems publishing credentials are configured for your deployment lane.

## OpenAPI clients

If you need another language, generate a client from:

```txt
https://opensend.namuh.co/openapi.json
```

Prefer the OpenAPI contract for exact schemas and route availability, then use these docs for workflow and operational context.
