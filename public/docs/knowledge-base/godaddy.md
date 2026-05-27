# Configure DNS in GoDaddy

Use this guide for domains whose authoritative DNS is GoDaddy. The most common errors are duplicate TXT records and host names entered with the domain twice.

## Setup

1. Add the domain in OpenSend.
2. In GoDaddy, open the domain's DNS management page.
3. Add the DKIM, SPF/MAIL FROM, DMARC, and tracking records shown by OpenSend.
4. If GoDaddy asks for **Name** or **Host**, enter the relative host unless the UI explicitly expects the full domain.
5. Save, wait for DNS propagation, and verify in OpenSend.

## Troubleshooting

- Use only one SPF TXT record per hostname.
- Use only one DMARC TXT record at `_dmarc`.
- Do not put quotes around TXT values unless GoDaddy's UI adds them automatically.
- If verification alternates between pass and fail, check whether multiple DNS providers are authoritative for the domain.
