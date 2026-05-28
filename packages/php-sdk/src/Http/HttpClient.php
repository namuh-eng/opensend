<?php

declare(strict_types=1);

namespace OpenSend\Http;

use JsonException;
use OpenSend\Constants;
use OpenSend\Contracts\HttpTransport;
use OpenSend\Errors\ApiException;
use OpenSend\ValueObjects\RequestOptions;

final class HttpClient
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl,
        private readonly HttpTransport $transport = new StreamHttpTransport(),
    ) {
    }

    /**
     * @param array<string, mixed>|null $payload
     * @return array<string, mixed>
     */
    public function request(string $method, string $path, ?array $payload = null, ?RequestOptions $options = null): array
    {
        $body = null;
        if ($payload !== null) {
            try {
                $body = json_encode($payload, JSON_THROW_ON_ERROR);
            } catch (JsonException $exception) {
                throw new ApiException('Failed to encode OpenSend request JSON.', 0, 'request_error', 'request_error', previous: $exception);
            }
        }

        $headers = [
            'Accept' => 'application/json',
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
            'User-Agent' => Constants::USER_AGENT,
        ];

        if ($options?->idempotencyKey !== null) {
            $headers['Idempotency-Key'] = $options->idempotencyKey;
        }

        $response = $this->transport->send(
            strtoupper($method),
            $this->endpoint($path),
            $headers,
            $body,
        );

        $decoded = $this->decodeJson($response->body, $response->statusCode);
        if ($response->statusCode < 200 || $response->statusCode >= 300) {
            throw $this->apiException($response, $decoded);
        }

        return $decoded;
    }

    private function endpoint(string $path): string
    {
        return rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/');
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJson(string $body, int $statusCode): array
    {
        if (trim($body) === '') {
            return [];
        }

        try {
            $decoded = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new ApiException(
                'Invalid JSON response from OpenSend.',
                $statusCode,
                'parse_error',
                'parse_error',
                rawBody: $body,
                previous: $exception,
            );
        }

        if (!is_array($decoded)) {
            throw new ApiException(
                'OpenSend returned a JSON response that was not an object.',
                $statusCode,
                'parse_error',
                'parse_error',
                rawBody: $body,
            );
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    /**
     * @param array<string, mixed> $decoded
     */
    private function apiException(HttpResponse $response, array $decoded): ApiException
    {
        $message = $this->stringValue($decoded['message'] ?? null)
            ?? $this->stringValue($decoded['error'] ?? null)
            ?? 'OpenSend API request failed.';
        $name = $this->stringValue($decoded['name'] ?? null);
        $code = $this->stringValue($decoded['code'] ?? null);
        $details = isset($decoded['details']) && is_array($decoded['details']) ? $decoded['details'] : null;

        return new ApiException($message, $response->statusCode, $name, $code, $details, $response->body);
    }

    private function stringValue(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
