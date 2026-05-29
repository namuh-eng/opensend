<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use OpenSend\Client;
use OpenSend\Errors\ApiException;
use OpenSend\ValueObjects\RequestOptions;

$apiKey = getenv('OPENSEND_API_KEY');
if (!is_string($apiKey) || trim($apiKey) === '') {
    fwrite(STDERR, "Set OPENSEND_API_KEY before running this example.\n");
    exit(1);
}

$client = new Client(
    apiKey: $apiKey,
    baseUrl: getenv('OPENSEND_BASE_URL') ?: null,
);

try {
    $email = $client->emails->send([
        'from' => 'OpenSend <hello@example.com>',
        'to' => 'recipient@example.com',
        'subject' => 'Hello from OpenSend PHP',
        'html' => '<h1>It works!</h1>',
    ], RequestOptions::withIdempotencyKey('php-example-' . date('YmdHis')));

    echo "Queued email {$email->id}\n";
} catch (ApiException $error) {
    fwrite(STDERR, "OpenSend API error {$error->statusCode()}: {$error->getMessage()}\n");
    if ($error->details() !== null) {
        fwrite(STDERR, json_encode($error->details(), JSON_PRETTY_PRINT) . "\n");
    }
    exit(1);
}
