# Dashboard Domains

Domains connect your sender identity to DNS records required for authenticated email. In OpenSend, a verified domain is required for trustworthy production sending.

## Workflow

1. Add a domain in **Domains**.
2. Publish the DNS records shown by OpenSend: DKIM, SPF/MAIL FROM, DMARC, and tracking records when enabled.
3. Use auto-configuration only when the deployment has Cloudflare credentials and the domain is in the configured zone.
4. Click verify after DNS has propagated.
5. Use a from address on a verified domain for production sends.

## Hosted and self-hosted behavior

OpenSend Cloud uses the hosted app domain and configured SES identity flow. Self-hosted operators must provide AWS SES credentials, DNS provider access if using auto-configuration, and correct public app/tracking URLs.
