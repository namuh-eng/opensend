# Send emails with Ruby

Send email from Ruby with the first-party OpenSend Ruby SDK.

## Install

The `opensend` gem package is ready for RubyGems publishing. Until the
RubyGems release is available, build and install it from this repository:

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
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`.
Set `OPENSEND_BASE_URL` only when using a self-hosted OpenSend deployment.

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

See `packages/ruby-sdk/README.md` for the full API surface and migration alias.
