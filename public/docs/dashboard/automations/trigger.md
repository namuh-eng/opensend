# Automation Trigger Step

The trigger step starts an automation run. It usually listens for a custom event such as `user.signed_up`, `trial.started`, or `invoice.paid`.

## Configuration

Choose an event name that matches what your application sends to OpenSend. Keep event names stable and version your payload schema when the meaning changes.

## Testing

Send a test event through the Events API and then open the automation runs page. If no run appears, confirm the automation is enabled, the event name matches exactly, and the event belongs to the same tenant/workspace.
