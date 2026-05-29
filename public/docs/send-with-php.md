# Send emails with PHP

Send email from PHP with the first-party OpenSend PHP SDK. This first SDK slice supports the core single-email send path, idempotency keys, typed request/response objects, and typed OpenSend API errors.

## Install

Install from this repository until Packagist publishing is enabled:

```bash
composer config repositories.opensend path ../../packages/php-sdk
composer require opensend/opensend-php:dev-main
```

For development inside the OpenSend repository:

```bash
cd packages/php-sdk
composer install
composer test
```

## Configure

Keep the API key on the server. If `OPENSEND_BASE_URL` is unset, the SDK targets OpenSend Cloud at `https://opensend.namuh.co`.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

## Send one email

```php
<?php

require __DIR__ . '/vendor/autoload.php';

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
            from: 'hello@yourdomain.com',
            to: ['recipient@example.com'],
            subject: 'Hello from OpenSend',
            html: '<h1>It works!</h1>',
        ),
        RequestOptions::withIdempotencyKey('receipt-123'),
    );

    echo $email->id . PHP_EOL;
} catch (ApiException $error) {
    error_log($error->errorCode() . ': ' . $error->getMessage());
    http_response_code($error->statusCode() ?: 500);
}
```

## Array payloads

You can also pass arrays shaped like the REST API. `replyTo`, `scheduledAt`, and `topicId` aliases are normalized to `reply_to`, `scheduled_at`, and `topic_id` before the request is sent.

```php
$email = $client->emails->send([
    'from' => 'hello@yourdomain.com',
    'to' => 'recipient@example.com',
    'subject' => 'Receipt',
    'text' => 'Thanks for your purchase.',
    'replyTo' => 'support@yourdomain.com',
]);
```

## Error handling

OpenSend API error envelopes are raised as `OpenSend\Errors\ApiException`.

```php
try {
    $client->emails->send($payload);
} catch (ApiException $error) {
    $status = $error->statusCode();
    $code = $error->errorCode();
    $details = $error->details();
}
```

The exception preserves `statusCode`, `name`, `code`, sanitized `details`, and the raw response body for logging or debugging. Do not log API keys or message content in production logs.

## Supported resources

The PHP SDK currently supports `client->emails->send(...)` only. Use the REST API for reads, batch sends, contacts, domains, webhooks, suppressions, broadcasts, and API keys until those PHP resource clients are added.
