# Examples

Example application patterns for OpenSend. Start with the SDK or framework guide that matches your runtime, then adapt the sender domain, base URL, and secret storage to your deployment.

## Published npm package

- [Send one email with `opensend`](https://github.com/namuh-eng/opensend/tree/main/examples/npm-send-email): minimal Node/Bun example that installs the published npm package, reads local environment variables, and sends one test email.

## SDK quickstarts

- [Official SDKs](./sdks.md)
- [Node.js](./send-with-nodejs.md)
- [Bun](./send-with-bun.md)
- [Python](./send-with-python.md)
- [Go](./send-with-go.md)
- [Ruby](./send-with-ruby.md)
- [SMTP](./send-with-smtp.md)

## Framework quickstarts

- [Next.js](./send-with-nextjs.md)
- [Express](./send-with-express.md)
- [Hono](./send-with-hono.md)
- [FastAPI](./send-with-fastapi.md)
- [Flask](./send-with-flask.md)
- [Django](./send-with-django.md)
- [Rails](./send-with-rails.md)
- [Sinatra](./send-with-sinatra.md)

## Runtime and deployment quickstarts

- [Cloudflare Workers](./send-with-cloudflare-workers.md)
- [AWS Lambda](./send-with-aws-lambda.md)
- [Vercel](./send-with-vercel.md)
- [Railway](./send-with-railway.md)

## When to use each sending surface

| Surface | Use it when | Avoid it when |
| --- | --- | --- |
| SDK / REST `/emails` | Transactional mail such as signups, receipts, invites, passwordless auth, alerts | You need to send one campaign to a large audience |
| `/emails/batch` | You have a small set of transactional messages to queue together | You need segmentation, unsubscribe topics, or campaign reporting |
| Broadcasts | You are sending campaign or lifecycle mail to contacts/segments | You need a one-off transactional response inside a request |
| SMTP relay | A legacy app only supports SMTP | You need templates, scheduling, or direct API response details |

## Environment checklist

Every example expects:

```bash
OPENSEND_API_KEY=os_your_api_key
# Optional for self-hosted deployments:
OPENSEND_BASE_URL=https://opensend.namuh.co
```

Use a verified sending domain before production sends. Use idempotency keys for flows that can retry.
