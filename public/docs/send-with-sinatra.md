# Send emails with Sinatra

Use the Ruby SDK from Sinatra routes or background jobs.

## Install

After RubyGems publishing is available:

```bash
gem install sinatra opensend
```

Until then, build and install the OpenSend gem from `packages/ruby-sdk` in this repository.

## Example

```ruby
require "json"
require "opensend"
require "sinatra"

OpenSend.api_key ENV.fetch("OPENSEND_API_KEY")
OpenSend.base_url ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)

post "/send" do
  content_type :json
  body = JSON.parse(request.body.read)
  email_address = body["email"]

  halt 400, { error: "email is required" }.to_json unless email_address

  email = OpenSend.emails.send(
    from: "OpenSend <onboarding@updates.example.com>",
    to: email_address,
    subject: "Hello from Sinatra",
    html: "<p>Sinatra queued this email.</p>"
  )

  { id: email.fetch("id") }.to_json
end
```

## Notes

- Keep the API key server-side.
- Use a background job library for sends that should not block the request.
- Use idempotency keys when routes can be retried by proxies or clients.
