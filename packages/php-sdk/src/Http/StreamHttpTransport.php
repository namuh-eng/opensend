<?php

declare(strict_types=1);

namespace OpenSend\Http;

use OpenSend\Contracts\HttpTransport;
use OpenSend\Errors\ApiException;

final class StreamHttpTransport implements HttpTransport
{
    /**
     * @param array<string, string> $headers
     */
    public function send(string $method, string $url, array $headers, ?string $body): HttpResponse
    {
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headerLines),
                'content' => $body ?? '',
                'ignore_errors' => true,
                'timeout' => 30,
            ],
        ]);

        $rawBody = @file_get_contents($url, false, $context);
        if ($rawBody === false) {
            $lastError = error_get_last();
            throw new ApiException(
                $lastError['message'] ?? 'OpenSend request failed before a response was received.',
                0,
                'request_error',
                'request_error',
            );
        }

        /** @var list<string> $responseHeaders */
        $responseHeaders = $http_response_header ?? [];

        return new HttpResponse(
            $this->statusCode($responseHeaders),
            $rawBody,
            $this->headers($responseHeaders),
        );
    }

    /**
     * @param list<string> $headers
     */
    private function statusCode(array $headers): int
    {
        foreach ($headers as $line) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/', $line, $matches) === 1) {
                return (int) $matches[1];
            }
        }

        return 0;
    }

    /**
     * @param list<string> $headers
     * @return array<string, string>
     */
    private function headers(array $headers): array
    {
        $parsed = [];
        foreach ($headers as $line) {
            if (!str_contains($line, ':')) {
                continue;
            }

            [$name, $value] = explode(':', $line, 2);
            $parsed[strtolower(trim($name))] = trim($value);
        }

        return $parsed;
    }
}
