# Tracking Domains

Tracking domains brand open and click tracking links to your domain instead of a generic application host. This improves trust and keeps tracking URLs aligned with your sender identity.

## Setup

1. Enable tracking for the domain.
2. Publish the CNAME shown in the domain DNS records.
3. Wait for DNS propagation.
4. Send a low-volume test email and confirm tracked links resolve through your OpenSend deployment.

## Self-hosted caveat

The CNAME target must point at a route served by your OpenSend app. If you deploy behind a proxy or CDN, make sure `/api/track/open/*` and `/api/track/click/*` reach the app.
