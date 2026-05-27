# Forward Received Emails

Automatic forwarding is not implemented in the OpenSend repository today.

If your deployment needs forwarding, build it as an operator workflow after receiving storage succeeds: read the parsed email through OpenSend, apply allowlists and loop-prevention rules, then send a new outbound email through the regular send API.

## Recommended safeguards

- Do not forward raw attachments until they pass policy checks.
- Add loop detection, such as custom headers or recipient allowlists.
- Preserve audit logs that identify the original received email ID.
- Keep forwarding credentials outside the agent runtime.
