# Configure DNS in Cloudflare

Use this guide when your sending or receiving domain is hosted in Cloudflare. OpenSend can auto-configure records only when the deployment has a Cloudflare API token and the target zone is available to that token; otherwise publish the records manually.

## Sending records

1. Open **Domains** in OpenSend and add the domain.
2. Copy each DNS record exactly: DKIM CNAME/TXT records, SPF/MAIL FROM records, DMARC, and tracking CNAME when enabled.
3. In Cloudflare, set records that OpenSend expects to resolve directly to **DNS only** unless the record is specifically meant to proxy HTTP traffic. Mail authentication records should not be proxied.
4. Wait for DNS propagation, then click **Verify** in OpenSend.

## Common Cloudflare issues

- Orange-cloud proxying on mail-authentication records can hide the expected target.
- A duplicate SPF or DMARC record can cause mailbox providers to ignore both.
- The zone must match the exact domain you are adding; subdomain delegation changes where records belong.
- Auto-configuration needs API permissions for DNS edit access on the zone.

For receiving/MX setup, confirm that existing MX records are not still pointing to another mail provider unless you intentionally route mail elsewhere.
