# opensend-php

First-party PHP SDK for OpenSend. This initial v1 slice focuses on the core send-email path and shared HTTP/error plumbing that future resource clients can reuse.

## Install

Install from this repository until Packagist publishing is enabled:

```bash
composer config repositories.opensend path ../../packages/php-sdk
composer require opensend/opensend-php:dev-main
```

For local development inside this repo:

```bash
cd packages/php-sdk
composer install
composer test
```

## Send an email

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
            from: 'OpenSend <hello@example.com>',
            to: ['user@example.com'],
            subject: 'Hello from OpenSend',
            html: '<strong>It works.</strong>',
        ),
        RequestOptions::withIdempotencyKey('welcome-user-123'),
    );

    echo $email->id . PHP_EOL;
} catch (ApiException $error) {
    error_log($error->errorCode() . ': ' . $error->getMessage());
    http_response_code($error->statusCode() ?: 500);
}
```

The SDK targets `https://opensend.namuh.co` by default. Pass `baseUrl` for a self-hosted OpenSend deployment.

## Payloads

Use `OpenSend\ValueObjects\SendEmailRequest` for typed constructor validation, or pass an array with the same REST keys:

```php
$email = $client->emails->send([
    'from' => 'hello@example.com',
    'to' => 'user@example.com',
    'subject' => 'Receipt',
    'text' => 'Thanks for your purchase.',
    'replyTo' => 'support@example.com', // normalized to reply_to
]);
```

At least one of `html`, `text`, or `template` is required. The SDK validates required fields locally and maps OpenSend error envelopes to `OpenSend\Errors\ApiException` with `statusCode()`, `name()`, `errorCode()`, `details()`, and `rawBody()` accessors.

## Publishing notes

- Package name: `opensend/opensend-php`
- Runtime requirement: PHP 8.1+
- Dev/test dependency: PHPUnit 10
- Do not commit API keys, Packagist tokens, or registry credentials. Configure publishing credentials in CI or your local Composer auth config when release automation is added.
