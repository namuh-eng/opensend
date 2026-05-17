# Ruby SDK

OpenSend includes a minimal first-party Ruby SDK package at
[`packages/ruby-sdk`](../../packages/ruby-sdk) for transactional
email sends through OpenSend.

Use your OpenSend API key (`os_...`) with OpenSend's Ruby API surface.
Existing Resend-style send calls can migrate through the alias documented
below.

## Install

From this repository:

```bash
cd packages/ruby-sdk
gem build opensend.gemspec
gem install ./opensend-0.1.0.gem
```

The gem metadata is ready for publishing as `opensend`. Until the RubyGems
publish is complete, install the built gem from this repository. After
publication, use `gem install opensend`.

## Configure

Store API keys in environment variables; do not hardcode real keys.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`.

## Send

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

For existing send code migrating to OpenSend, `Resend` is an alias for
`OpenSend` after requiring this package:

```ruby
require "opensend"

Resend.api_key ENV.fetch("OPENSEND_API_KEY")
Resend::Emails.send(
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

Non-2xx responses raise `OpenSend::Error` with `status_code`, `name`, `code`,
`message`, `details`, and raw `body` fields when the OpenSend API error envelope
includes them.
