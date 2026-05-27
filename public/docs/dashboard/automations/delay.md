# Automation Delay Step

Delay steps pause a run before it continues. Use them for onboarding spacing, follow-ups, and waiting periods between lifecycle messages.

## Guidance

Use the shortest delay that matches the product intent. Long delays make it more important to preserve templates, domains, and segment assumptions because the run may resume days later.

## Troubleshooting

If runs stay delayed past their expected time, check the scheduled processor/worker. In self-hosted deployments, the app alone is not enough; the background processing path must be deployed and authorized.
