# DMARC

DMARC tells mailbox providers how to evaluate mail that fails SPF or DKIM alignment. OpenSend displays DNS records that help align your sending domain, but you own the policy choice.

## Recommended rollout

Start with a monitoring policy while you confirm legitimate traffic:

```txt
v=DMARC1; p=none; rua=mailto:dmarc@example.com
```

After you verify all legitimate sources are aligned, move gradually to `quarantine` or `reject` based on your organization's deliverability policy.

## Troubleshooting

If a domain verifies but mail still lands in spam, inspect whether the visible From domain aligns with DKIM and MAIL FROM/SPF. Also check for duplicate or conflicting DMARC records at the DNS provider.
