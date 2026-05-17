# Retries and Replays

Handle webhook delivery failures.

OpenSend records webhook deliveries and supports replay through `POST /api/webhooks/{id}/deliveries/{deliveryId}/replay` where enabled.
