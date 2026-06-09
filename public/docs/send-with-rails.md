# Send emails with Rails

Use the Ruby SDK from Rails controllers, jobs, mailer adapters, or service objects.

## Install

Until RubyGems publishing is available, build and install the gem from this repository. After publication, add it to your Gemfile:

```ruby
gem "opensend"
```

Then run:

```bash
bundle install
```

## Initializer

Create `config/initializers/opensend.rb`:

```ruby
require "opensend"

OpenSend.api_key ENV.fetch("OPENSEND_API_KEY")
OpenSend.base_url ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)
```

## Service object

```ruby
class WelcomeEmail
  def self.deliver(email_address)
    OpenSend.emails.send(
      {
        from: "OpenSend <onboarding@updates.example.com>",
        to: email_address,
        subject: "Welcome",
        html: "<p>Rails queued this email.</p>"
      },
      idempotency_key: "welcome-#{email_address}"
    ).fetch("id")
  end
end
```

## Active Job example

```ruby
class WelcomeEmailJob < ApplicationJob
  queue_as :default

  def perform(user_id)
    user = User.find(user_id)
    WelcomeEmail.deliver(user.email)
  end
end
```

## Notes

- Keep `OPENSEND_API_KEY` in Rails credentials or deployment secrets.
- Use idempotency keys for jobs that can retry.
- For bulk audience sends, use OpenSend broadcasts and segments instead of one Rails job per recipient unless you intentionally need per-recipient transactional mail.
