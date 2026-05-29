# Receiving Routing

Receiving routes decide which stored inbox target should own an inbound recipient on a verified receiving domain. They do not forward mail, send replies, or create provider DNS records.

## Route types

OpenSend supports three route types per receiving-enabled verified domain:

| Type | Match | Target |
| --- | --- | --- |
| Exact | A full local part such as `support` for `support@inbound.example.com`. | Defaults to the same local part unless you set a target local part. |
| Alias | A local part that points at another local target on the same domain. | Required target local part, such as `inbox`. |
| Catch-all | Any otherwise unmatched local part on the domain. | Required target local part. Only one catch-all route is allowed per domain. |

## Precedence

For each recipient, OpenSend evaluates routes in this order:

1. Exact address.
2. Alias.
3. Catch-all.
4. Unrouteable.

This means an exact route for `support@inbound.example.com` wins even if an alias with the same local part exists. If no route matches and there is no catch-all, the route decision is `unrouteable`.

## Tenant and domain requirements

Routes can only be created for domains owned by the caller's tenant. The domain must be verified and have receiving enabled. A tenant can use the same local part as another tenant on a different domain because matching is domain-scoped.

## Auditability

Received email rows can store `route_decisions`, one decision per recipient. A decision records the recipient, route status, matching route ID when one matched, route type, local part, domain ID, and target address. Received-email list and detail responses include these decisions so downstream processors and support tools can explain why a message was stored or marked unrouteable.

## Limits of this slice

This routing model is storage and audit infrastructure. Forwarding delivery, threaded replies, provider receipt-rule creation, and DNS automation changes remain operator-owned or future work.
