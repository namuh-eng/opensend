# opensend Ruby SDK

Minimal first-party Ruby SDK for OpenSend transactional email sends with a
familiar API surface.

Use your OpenSend API key (`os_...`) with OpenSend's Ruby API surface.
Existing Resend-style send calls can migrate through the alias documented
below.

## Installation

This package is ready for RubyGems publishing. Until the RubyGems publish is
complete, install the built gem from this repository:

```bash
cd packages/ruby-sdk
gem build opensend.gemspec
gem install ./opensend-0.1.0.gem
```

After `opensend` is published to RubyGems, install it with:

```bash
gem install opensend
```

## Setup

Use an environment variable instead of hardcoding API keys:

```bash
export OPENSEND_API_KEY="os_your_api_key"
```

For self-hosted OpenSend, point the SDK at your deployment origin. The default
hosted origin is `https://opensend.namuh.co`.

```bash
export OPENSEND_BASE_URL="http://localhost:3015"
```

## Send an email

The module-level surface uses OpenSend while keeping familiar Ruby email-send
ergonomics:

```ruby
require "opensend"

OpenSend.api_key ENV.fetch("OPENSEND_API_KEY")
OpenSend.base_url ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)

email = OpenSend::Emails.send(
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from OpenSend",
  html: "<h1>It works!</h1>"
)

puts email.fetch("id")
```

`Resend` is also exported as an alias constant for existing send code migrating
to OpenSend:

```ruby
require "opensend"

Resend.api_key ENV.fetch("OPENSEND_API_KEY")
email = Resend::Emails.send(
  from: "hello@yourdomain.com",
  to: ["recipient@example.com"],
  subject: "Hello from OpenSend",
  text: "It works!"
)
```

## Instance client

```ruby
client = OpenSend::Client.new(
  api_key: ENV.fetch("OPENSEND_API_KEY"),
  base_url: ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)
)

email = client.emails.send(
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from OpenSend",
  html: "<h1>It works!</h1>"
)
```

## Errors

Non-2xx API responses raise `OpenSend::Error` (also exported as
`OpenSend::APIError`). The exception keeps OpenSend's public error envelope
fields when present.

```ruby
begin
  OpenSend::Emails.send(params)
rescue OpenSend::Error => error
  warn [error.status_code, error.code, error.message, error.details].inspect
end
```

## Supported first slice

- `OpenSend::Emails.send(params)` → `POST /emails`
- `OpenSend::Client#emails.send(params)` → `POST /emails`
- Bearer API key auth
- Configurable base URL
- Structured API error envelope parsing
- Resend alias constant for existing send code migrating to OpenSend

This first package intentionally does not implement batch sends, async jobs,
attachments helpers, or full resource-surface parity yet.

## Tests

```bash
ruby -I packages/ruby-sdk/lib packages/ruby-sdk/test/opensend_test.rb
```
