# What if my domain is not verifying?

Domain verification fails when OpenSend or the provider cannot see the expected DNS records. Most failures are record-name mistakes, duplicate TXT records, wrong DNS provider, or propagation delays.

## Checklist

1. Confirm the domain's authoritative nameservers.
2. Add records at the authoritative DNS provider, not an old provider.
3. Check DKIM selector records exactly as shown.
4. Merge SPF into one TXT record per host.
5. Keep one DMARC record at `_dmarc.<domain>`.
6. Disable proxying for DNS authentication records.
7. Wait for TTL/propagation and verify again.

## Self-hosted caveat

OpenSend's verification behavior depends on the configured AWS SES region and credentials. If records look correct but verification still fails, confirm the SES identity exists in the same region your deployment uses.
