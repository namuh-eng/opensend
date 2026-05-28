# Official SDKs

OpenSend ships first-party SDKs for the languages most teams use to send mail from production services. All SDKs target OpenSend Cloud by default at `https://opensend.namuh.co` and can point at a self-hosted deployment by setting a base URL.

Use an OpenSend API key that starts with `os_`. Keep keys in server-side environment variables and never expose them to browser JavaScript, mobile apps, or public repositories.

## SDK status

| SDK | Package | Best for | Status |
| --- | --- | --- | --- |
| TypeScript / JavaScript | `opensend` on npm | Node.js, Bun, Next.js, serverless functions, React Email rendering | First-party package |
| Python | `packages/python-sdk` / future `opensend` PyPI package | Django, Flask, FastAPI, scripts, workers | First-party package; install from the repo until PyPI publishing is enabled |
| Go | `github.com/namuh-eng/opensend/packages/go-sdk` | API services, workers, CLIs | First-party module |
| Ruby | `packages/ruby-sdk` / future `opensend` gem | Rails, Sinatra, Ruby jobs | First-party package; install from the repo until RubyGems publishing is enabled |
| PHP | `packages/php-sdk` / future `opensend/opensend-php` Composer package | PHP services, Laravel/Symfony apps, workers | First-party send-email slice; install from the repo until Packagist publishing is enabled |
| SMTP relay | `@opensend/smtp-relay` service | Apps that only speak SMTP | Self-hosted relay service |
| Other languages | `/openapi.json` | Generated clients | Generate from the OpenAPI contract |

## TypeScript and JavaScript

Install the npm package:

```bash
npm install opensend
```

Send an email:

```ts
import { Resend } from "opensend";

const resend = new Resend(process.env.OPENSEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: ["user@example.com"],
  subject: "Hello from OpenSend",
  html: "<strong>It works.</strong>",
});

if (error) throw new Error(error.message);
console.log(data.id);
```

The TypeScript SDK exports both `Resend` for migration-friendly code and `Opensend` as the first-party client name. It accepts `replyTo`, `scheduled_at`, `attachments`, `tags`, and `template` payloads that match the REST API. React email components are rendered locally by the SDK when you pass `react` and install `react` plus `react-dom`.

For self-hosting, pass `baseUrl`:

```ts
import { Opensend } from "opensend";

const opensend = new Opensend(process.env.OPENSEND_API_KEY, {
  baseUrl: process.env.OPENSEND_BASE_URL,
});
```

## Python

Install from this repository until PyPI publishing is complete:

```bash
python -m pip install ./packages/python-sdk
```

After the package is published, use the public package name:

```bash
python -m pip install opensend
```

Use the instance client for services and tests:

```python
import os
from opensend import OpenSend

client = OpenSend(
    os.environ["OPENSEND_API_KEY"],
    base_url=os.environ.get("OPENSEND_BASE_URL"),
)

email = client.emails.send({
    "from": "OpenSend <onboarding@updates.example.com>",
    "to": ["user@example.com"],
    "subject": "Hello from OpenSend",
    "html": "<strong>It works.</strong>",
})
print(email["id"])
```

Python reserves `from` as a keyword, so the SDK accepts dictionaries using the JSON key (`"from"`) and also normalizes `from_` or `from_email` keys.

## Go

Install the Go module from this repository:

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.2.0
```

Send one email:

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"

    opensend "github.com/namuh-eng/opensend/packages/go-sdk"
)

func main() {
    opts := []opensend.Option{}
    if baseURL := os.Getenv("OPENSEND_BASE_URL"); baseURL != "" {
        opts = append(opts, opensend.WithBaseURL(baseURL))
    }

    client, err := opensend.NewClient(os.Getenv("OPENSEND_API_KEY"), opts...)
    if err != nil {
        log.Fatal(err)
    }

    email, err := client.Emails.Send(context.Background(), opensend.SendEmailRequest{
        From:    "OpenSend <onboarding@updates.example.com>",
        To:      []string{"user@example.com"},
        Subject: "Hello from OpenSend",
        HTML:    "<strong>It works.</strong>",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(email.ID)
}
```

## Ruby

Build and install locally until RubyGems publishing is complete:

```bash
cd packages/ruby-sdk
gem build opensend.gemspec
gem install ./opensend-0.1.0.gem
```

After publication:

```bash
gem install opensend
```

Send one email:

```ruby
require "opensend"

OpenSend.api_key ENV.fetch("OPENSEND_API_KEY")
OpenSend.base_url ENV.fetch("OPENSEND_BASE_URL", OpenSend::DEFAULT_BASE_URL)

email = OpenSend.emails.send(
  from: "OpenSend <onboarding@updates.example.com>",
  to: "user@example.com",
  subject: "Hello from OpenSend",
  html: "<strong>It works.</strong>"
)
puts email.fetch("id")
```

The Ruby package also exports `Resend` as a compatibility alias for migration-oriented code.


## PHP

Install from this repository until Packagist publishing is complete:

```bash
composer config repositories.opensend path ../../packages/php-sdk
composer require opensend/opensend-php:dev-main
```

Send one email:

```php
<?php

use OpenSend\Client;
use OpenSend\Errors\ApiException;
use OpenSend\ValueObjects\RequestOptions;
use OpenSend\ValueObjects\SendEmailRequest;

$client = new Client(
    apiKey: getenv('OPENSEND_API_KEY') ?: '',
    baseUrl: getenv('OPENSEND_BASE_URL') ?: null,
);

try {
    $email = $client->emails->send(
        new SendEmailRequest(
            from: 'OpenSend <onboarding@updates.example.com>',
            to: ['user@example.com'],
            subject: 'Hello from OpenSend',
            html: '<strong>It works.</strong>',
        ),
        RequestOptions::withIdempotencyKey('welcome-user-123'),
    );

    echo $email->id;
} catch (ApiException $error) {
    throw $error;
}
```

The PHP SDK currently supports single-email sends plus shared request, response, idempotency, and error-envelope plumbing. Use the REST API for other resources until more PHP clients are added.

## SMTP relay

Use the SMTP relay when an application cannot call the REST API or an SDK. The relay is a separate OpenSend service that authenticates with an OpenSend API key as the SMTP password, parses MIME, creates a queued email row, and publishes the normal delivery job.

- Default port: `2587`
- Username: any non-empty value, commonly `apikey`
- Password: your OpenSend API key
- TLS: STARTTLS when you configure `SMTP_RELAY_TLS_CERT_PATH` and `SMTP_RELAY_TLS_KEY_PATH`

See [Send email with SMTP](./send-with-smtp.md) for deployment and client examples.

## OpenAPI clients

If your language is not listed, generate a client from the OpenAPI contract:

```txt
https://opensend.namuh.co/openapi.json
```

Use `/openapi.json` for exact schemas and route availability, then use these guides for application workflow, environment variables, and operational caveats.
