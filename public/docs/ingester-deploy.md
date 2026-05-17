# Ingester Deployment

Deploy the SES/SNS ingester and queue worker.

The ingester service handles provider events and scheduled worker behavior. Point SES SNS topics at the ingester endpoint, not the app URL.
