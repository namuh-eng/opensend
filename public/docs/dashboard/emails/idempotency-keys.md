# Idempotency Keys

Safely retry send requests.

Set `Idempotency-Key` on single or batch send requests. OpenSend stores accepted responses and replays them for duplicate retries inside the replay window.

Use stable keys derived from your own operation id, not random values for each retry.
