# SPF, DKIM, and DMARC for OpenSend

Mailbox providers use SPF, DKIM, and DMARC to decide whether a sender is authenticated. OpenSend surfaces the DNS records needed for your deployment, but the domain owner is responsible for publishing and maintaining them.

## DKIM

DKIM proves that mail was authorized by the domain through cryptographic signatures. Publish the DKIM records OpenSend shows for the domain. Do not proxy or rewrite those records through a CDN.

## SPF and MAIL FROM

SPF authorizes the infrastructure that sends mail for a domain. If your domain already has SPF, merge the required OpenSend/SES mechanism into the existing TXT record instead of creating a second SPF record at the same host.

## DMARC

DMARC tells receivers what to do when SPF or DKIM alignment fails. Start with `p=none` while you observe reports, then move toward `quarantine` or `reject` after all legitimate senders are aligned.

## Troubleshooting checklist

- One SPF record per host.
- One DMARC record at `_dmarc.<domain>`.
- DKIM selectors resolve publicly.
- The visible From domain matches the verified sending domain.
- The deployment's AWS SES region matches the identity records shown by OpenSend.
