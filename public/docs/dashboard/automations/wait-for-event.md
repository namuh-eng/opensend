# Automation Wait for Event Step

Wait-for-event pauses a run until a matching custom event arrives or the wait expires. It is useful for flows such as "send a reminder unless the user completes setup".

## Configuration

Use a precise event name and choose a timeout that matches the customer journey. The event should include enough identity information for OpenSend to match it to the waiting run.

## Troubleshooting

If runs never resume, confirm the application sends the exact event name to the same tenant and that the automation runner is processing waiting runs.
