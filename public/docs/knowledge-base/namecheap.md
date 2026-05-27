# Configure DNS in Namecheap

Namecheap can host OpenSend DNS records, but its UI may require you to enter record names relative to the domain. Copy carefully and verify the final resolved record.

## Setup

1. In OpenSend, add the domain and copy the DNS records.
2. In Namecheap, open **Domain List → Manage → Advanced DNS**.
3. Add DKIM, SPF/MAIL FROM, DMARC, and tracking records as shown.
4. For host/name fields, remove the base domain only if Namecheap automatically appends it.
5. Save changes and wait for propagation before verifying in OpenSend.

## Common mistakes

- Creating `selector._domainkey.example.com.example.com` by pasting a full host where Namecheap expects a relative host.
- Replacing an existing SPF record instead of merging mechanisms into one TXT record.
- Forgetting that DMARC lives at `_dmarc.example.com`.
- Adding MX records for receiving before an inbound processor is ready.
