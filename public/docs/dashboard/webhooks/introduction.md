# Dashboard Webhooks

The Webhooks dashboard manages outbound event subscriptions. Use it to create endpoints, choose event types, inspect delivery attempts, disable destinations, and replay failed or historical deliveries.

## Workflow

1. Create an endpoint URL that can receive HTTPS POST requests.
2. Select supported event types such as `email.sent`, `email.delivered`, `email.bounced`, or contact events.
3. Store the signing secret shown at creation time.
4. Verify `svix-id`, `svix-timestamp`, and `svix-signature` on every request.
5. Inspect delivery history and replay events when the receiver was down.

## Caveats

Webhook delivery requires the dispatcher/worker path. In self-hosted deployments, configure the ingester/worker and keep endpoint timeouts under the documented delivery timeout. `email.received` subscriptions are available for receiving-enabled domains and are queued after inbound MIME ingestion commits the received email row.
