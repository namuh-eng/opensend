# opensend Ruby SDK

Full-surface Ruby SDK for the OpenSend email platform. Works against the
OpenSend hosted API and against any self-hosted OpenSend deployment.

## Installation

Until the gem is published to RubyGems, build and install it locally:

```bash
cd packages/ruby-sdk
gem build opensend.gemspec
gem install ./opensend-0.1.0.gem
```

Once published, install with:

```bash
gem install opensend
```

## Setup

```bash
export OPENSEND_API_KEY="os_your_api_key"
# For self-hosted deployments:
export OPENSEND_BASE_URL="http://localhost:3015"
```

## Quick start

```ruby
require "opensend"

OpenSend.api_key ENV.fetch("OPENSEND_API_KEY")
OpenSend.base_url ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)

email = OpenSend.emails.send(
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from OpenSend",
  html: "<h1>It works!</h1>"
)
puts email.fetch("id")
```

## Instance client

Use an explicit client when you need per-request API keys or multiple
configurations in the same process:

```ruby
client = OpenSend::Client.new(
  api_key: ENV.fetch("OPENSEND_API_KEY"),
  base_url: ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)
)

email = client.emails.send(
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello",
  html: "<h1>It works!</h1>"
)
```

## Resend alias

`Resend` is exported as a drop-in alias for existing code migrating to
OpenSend:

```ruby
require "opensend"

Resend.api_key ENV.fetch("OPENSEND_API_KEY")
Resend::Emails.send(from: "hello@yourdomain.com", to: "user@example.com",
                    subject: "Hello", text: "It works!")
```

## Resource API reference

Every namespace is available on the module (`OpenSend.<resource>`) and on an
instance client (`client.<resource>`).

### Emails

```ruby
# Send a single email
client.emails.send(
  from: "hello@example.com",
  to: ["user@example.com"],
  subject: "Subject",
  html: "<p>Body</p>",
  reply_to: "support@example.com"   # also accepts replyTo:
)

# Idempotent send
client.emails.send(params, idempotency_key: "unique-key")

# Batch send
client.emails.send_batch([email1_params, email2_params])
client.emails.send_batch(payloads, idempotency_key: "batch-key")

# List, get, cancel
client.emails.list(limit: 25, after: "cursor", status: "sent")
client.emails.get("email_id")
client.emails.cancel("email_id")
```

### Domains

```ruby
client.domains.create(name: "example.com")
client.domains.list
client.domains.get("domain_id")
client.domains.update("domain_id", open_tracking: true)
client.domains.verify("domain_id")
client.domains.delete("domain_id")
```

### API Keys

```ruby
client.api_keys.create(name: "Production key")
client.api_keys.list
client.api_keys.delete("key_id")
```

### Contacts

```ruby
client.contacts.create(email: "user@example.com", first_name: "Alice")
client.contacts.list(limit: 50, after: "cursor")
client.contacts.get("contact_id")
client.contacts.update("contact_id", first_name: "Bob")
client.contacts.delete("contact_id")
```

### Segments

```ruby
client.segments.create(name: "VIP customers")
client.segments.list(search: "vip")
client.segments.get("segment_id")
client.segments.delete("segment_id")
client.segments.list_contacts("segment_id", limit: 100)
```

### Audiences

```ruby
client.audiences.create(name: "Newsletter")
client.audiences.list(limit: 10)
client.audiences.get("audience_id")
client.audiences.delete("audience_id")
```

### Broadcasts

```ruby
client.broadcasts.create(
  from: "news@example.com",
  subject: "May sale",
  name: "May 2026 blast",
  html: "<h1>Sale</h1>",
  reply_to: "help@example.com"      # also accepts replyTo:
)
client.broadcasts.list(status: "sent", search: "may")
client.broadcasts.get("broadcast_id")
client.broadcasts.update("broadcast_id", subject: "Updated subject")
client.broadcasts.delete("broadcast_id")
client.broadcasts.send("broadcast_id")
client.broadcasts.send("broadcast_id", { scheduled_at: "2026-06-01T10:00:00Z" },
                        idempotency_key: "send-key")
```

### Templates

```ruby
client.templates.create(name: "Welcome", html: "<h1>Hi {{name}}</h1>")
client.templates.list(status: "published", search: "welcome")
client.templates.get("template_id_or_alias")
client.templates.update("template_id", name: "Updated name")
client.templates.delete("template_id")
client.templates.publish("template_id")
client.templates.duplicate("template_id")
```

### Automations

```ruby
client.automations.create(
  name: "Welcome flow",
  steps: [
    { key: "trigger", type: "trigger" },
    { key: "send_welcome", type: "send_email", config: { template_id: "tmpl_..." } }
  ]
)
client.automations.list(status: "enabled")
client.automations.get("automation_id")
client.automations.update("automation_id", name: "Renamed")
client.automations.delete("automation_id")

# Runs
client.automations.list_runs("automation_id", status: "completed")
client.automations.get_run("automation_id", "run_id")
client.automations.cancel_run("automation_id", "run_id", reason: "User request")
client.automations.get_run_metrics("automation_id", from: "2026-01-01", to: "2026-05-01")
```

### Events (custom events)

```ruby
# Define a custom event schema
client.events.create(name: "purchase", schema: { amount: "number" })

# List defined events
client.events.list(limit: 20)

# Fire an event to trigger automations
client.events.send(event: "purchase", email: "user@example.com",
                   payload: { amount: 99.99 })
```

### Webhooks

```ruby
client.webhooks.create(endpoint: "https://hooks.example.com/ingest",
                        events: ["email.sent", "email.bounced"])
client.webhooks.list
client.webhooks.get("webhook_id")
client.webhooks.update("webhook_id", status: "disabled")
client.webhooks.delete("webhook_id")

# Deliveries
client.webhooks.list_deliveries("webhook_id", limit: 25)
client.webhooks.replay_delivery("webhook_id", "delivery_id")
```

### Topics

```ruby
client.topics.create(name: "Product Updates", default_subscription: "opt_in")
client.topics.list(search: "product")
client.topics.get("topic_id")
client.topics.update("topic_id", name: "New name")
client.topics.delete("topic_id")
```

### Suppressions

```ruby
client.suppressions.list(limit: 50)
client.suppressions.get("user@example.com")
client.suppressions.create(email: "user@example.com", reason: "bounce")
client.suppressions.delete("user@example.com")
```

### Logs

```ruby
client.logs.list(status: "200", method: "POST", limit: 100,
                  date_from: "2026-05-01", date_to: "2026-05-31")
client.logs.get("log_id")
```

## Errors

Non-2xx responses raise `OpenSend::Error` (aliased as `OpenSend::APIError`):

```ruby
begin
  client.emails.send(params)
rescue OpenSend::Error => e
  warn "#{e.status_code} #{e.code}: #{e.message}"
  warn e.details.inspect if e.details
end
```

Available attributes: `status_code`, `name`, `code`, `details`, `body`.

## Tests

```bash
ruby -Ilib -Itest packages/ruby-sdk/test/opensend_test.rb
```
