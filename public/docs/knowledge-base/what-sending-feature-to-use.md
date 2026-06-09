# What sending feature should I use?

OpenSend has several sending surfaces. Choose the one that matches the job instead of forcing every workflow through one endpoint.

| Need | Use | Why |
| --- | --- | --- |
| One transactional message | `/emails` or an SDK | Fast API response, idempotency support, direct lifecycle record |
| A few transactional messages together | `/emails/batch` | One request with per-message results |
| A campaign to a list | Broadcasts | Segments, unsubscribe handling, scheduling, and performance review |
| Lifecycle flow | Automations | Trigger, delay, condition, wait, and template steps |
| Legacy app with SMTP only | SMTP relay | Uses API keys and routes through the normal delivery pipeline |
| Generated client in another language | `/openapi.json` | Exact route and schema contract |

For retries, use idempotency keys. For high-volume marketing, use broadcasts and segments rather than loops over transactional sends.
