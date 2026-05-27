# Dashboard Broadcasts

Broadcasts are campaign-style sends built in the dashboard and delivered to an audience segment. Use broadcasts when you need one message to reach many contacts with unsubscribe handling, topic preferences, scheduling, and performance review.

## Workflow

1. Create or choose contacts and segments under **Audience**.
2. Create a broadcast and choose the sending domain/from address.
3. Build content in the editor.
4. Confirm an unsubscribe link/footer is present for marketing mail.
5. Send immediately or schedule for later.
6. Review performance and delivery state after the worker processes the campaign.

## Operational caveats

Broadcast delivery depends on the same worker and SES quota as transactional email. In self-hosted deployments, verify queue processing before a production campaign. For one-off transactional messages, prefer `/emails`; for campaign mail, prefer broadcasts instead of looping over `/emails` in app code.
