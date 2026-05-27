---
date: 2026-05-28
issue: g006-dashboard-product-docs
type: decision
promoted_to: null
---

# Dashboard docs should map to implemented routes and name missing surfaces

The dashboard has implemented routes for emails, broadcasts, domains, automations, templates, audience contacts/properties/segments/topics, webhooks, logs, API keys, and audit log. Suppressions are visible through email/contact/unsubscribe workflows and APIs, but there is not a separate full suppressions dashboard page in this repo yet.

Public product docs should say that distinction directly instead of implying a nonexistent suppressions UI. Worker-dependent features such as scheduled email, broadcasts, automations, webhooks, and delivery metrics should carry self-host caveats about the background worker/ingester path.
