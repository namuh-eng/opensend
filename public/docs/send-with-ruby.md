# Send emails with Ruby

Send email from Ruby with the first-party OpenSend Ruby SDK. It works in Rails, Sinatra, Ruby scripts, and background jobs.

## Install

The `opensend` gem package is ready for RubyGems publishing. Until the RubyGems release is available, build and install it from this repository:

```bash
cd packages/ruby-sdk
gem build opensend.gemspec
gem install ./opensend-0.1.0.gem
```

After publication, use:

```bash
gem install opensend
```

## Configure

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`.

## Send one email

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

Use an instance client when a process needs multiple API keys or base URLs:

```ruby
client = OpenSend::Client.new(
  api_key: ENV.fetch("OPENSEND_API_KEY"),
  base_url: ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)
)

client.emails.send(
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello",
  text: "It works!"
)
```

## Idempotency and batch sends

```ruby
client.emails.send(payload, idempotency_key: "receipt-123")
client.emails.send_batch([payload_one, payload_two], idempotency_key: "batch-123")
```

## Framework guides

- [Rails](./send-with-rails.md)
- [Sinatra](./send-with-sinatra.md)

The Ruby package also exports `Resend` as a compatibility alias for migration-oriented code.
