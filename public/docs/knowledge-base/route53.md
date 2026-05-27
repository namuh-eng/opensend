# Configure DNS in Amazon Route 53

Use this guide when Route 53 hosts the DNS zone for your OpenSend sending or receiving domain.

## Sending records

1. Add the domain in OpenSend.
2. Open the Route 53 hosted zone for the exact domain.
3. Create the DKIM, SPF/MAIL FROM, DMARC, and tracking records shown in OpenSend.
4. Leave the record names and values exact. Route 53 may display fully qualified names with a trailing dot; that is normal.
5. Wait for propagation, then verify the domain in OpenSend.

## Tips

- Use the public hosted zone, not a private VPC-only zone.
- Check for existing TXT records at the same name before adding SPF or DMARC.
- If SES is in a specific region, keep the OpenSend/AWS region configuration aligned with the deployment.
- For self-hosted receiving, point MX records only after you have a tested inbound processing path.

If verification fails, compare the records shown in OpenSend with `dig` output from a public resolver.
