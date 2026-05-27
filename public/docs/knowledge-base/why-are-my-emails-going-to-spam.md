# Why are my emails going to spam?

Spam placement is usually caused by a combination of authentication, reputation, list quality, content, and recipient engagement. OpenSend can help you see domain status, bounces, complaints, opens, clicks, logs, and suppression state, but mailbox providers make the final placement decision.

## First checks

1. Verify the sending domain in OpenSend.
2. Confirm DKIM, SPF, and DMARC resolve publicly.
3. Send from an address on the verified domain.
4. Check bounce and complaint rates in the dashboard.
5. Confirm recipients opted in and are not stale imports.
6. Make sure marketing mail includes a clear unsubscribe path.

## Gmail and Outlook notes

Large mailbox providers care about domain reputation, consistent identity, complaint rate, and recipient engagement. They also penalize deceptive subject lines, URL shorteners, image-only content, and sudden volume spikes from new domains.

## What to change

- Warm up volume gradually.
- Segment inactive recipients instead of mailing everyone.
- Use topics and suppressions to honor preferences.
- Keep content relevant to the opt-in source.
- Use a branded tracking domain when tracking links are enabled.

If only one recipient is affected, ask them to check filters and spam-folder training. If many recipients are affected, investigate domain authentication and list quality first.
