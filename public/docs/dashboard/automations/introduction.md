# Dashboard Automations

Automations are event-driven flows that combine triggers, waits, conditions, contact updates, and email sends. Use them for lifecycle messaging such as welcome flows, trial nudges, onboarding reminders, and reactivation campaigns.

## Builder model

An automation is a graph of steps connected by edges. The builder stores step keys, step types, configuration, and connections. Runs are created when the trigger event matches and then progress through the graph.

## Typical flow

1. Define a custom event schema if the trigger is application-specific.
2. Create an automation with a trigger step.
3. Add delay, condition, wait-for-event, send-email, or contact-update steps.
4. Choose a template or message content for send-email steps.
5. Enable the automation and test with a low-risk event.
6. Review runs for failures, waiting states, and cancellation.

## Caveat

Automations require the runner/worker path to be active. If events are accepted but runs do not progress, verify the worker and scheduled processing configuration.
