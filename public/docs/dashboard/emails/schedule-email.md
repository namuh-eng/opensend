# Schedule Email

Schedule email delivery for later.

Set `scheduled_at` on send requests. OpenSend supports explicit future timestamps and the narrow supported relative formats implemented by the validation layer.

Scheduled emails can be canceled through `POST /emails/{email_id}/cancel` before they are sent.
