# Reply To Received Emails

OpenSend does not currently provide a one-click inbound reply API.

To build replies, retrieve the received email, generate or draft a response in your application, and send through `POST /emails` with a verified `from` address. For human-support workflows, keep the generated reply as a draft until an operator approves it.

## Reply guidance

- Use the original sender as the outbound recipient only after validating it.
- Avoid quoting secrets, raw headers, or unsafe attachments back to the sender.
- Include your support or agent thread ID in application metadata so follow-up messages can be linked by your receiving worker.
