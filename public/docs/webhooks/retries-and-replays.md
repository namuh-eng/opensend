# Retries and Replays

OpenSend records webhook delivery attempts and retries failed deliveries.

A delivery succeeds when the endpoint returns any `2xx` response. Non-2xx responses, timeouts, network errors, unsafe URL rejections, disabled endpoints, or unsupported event types are recorded on the delivery row.

## Retry schedule

The dispatcher uses these retry delays after failed attempts:

| Failed attempt | Next retry delay |
| --- | --- |
| 1 | 5 seconds |
| 2 | 5 minutes |
| 3 | 30 minutes |
| 4 | 2 hours |
| 5 | 5 hours |
| 6 | 10 hours |
| 7 | 10 hours |

The eighth failed attempt is marked `dead_letter`. The dispatch timeout is 5 seconds.

## Delivery fields

Delivery records expose:

- `status`: `pending`, `success`, `failed`, or `dead_letter`.
- `attempt`: number of dispatch attempts already made.
- `status_code`: HTTP status code from the last response, when available.
- `response_body`: first 1,000 characters of the response body or error message.
- `attempted_at`: timestamp of the last dispatch attempt.
- `next_retry_at`: when the delivery is eligible for another scan.

## Replays

Use `POST /api/webhooks/{id}/deliveries/{deliveryId}/replay` to create a new delivery for the original event. Replays require a tenant-scoped API key or dashboard session, the endpoint must still be active, and the original delivery must belong to that endpoint.
