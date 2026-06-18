<?php

declare(strict_types=1);

namespace OpenSend;

use InvalidArgumentException;
use OpenSend\Contracts\HttpTransport;
use OpenSend\Http\HttpClient;
use OpenSend\Http\StreamHttpTransport;
use OpenSend\Resources\Emails;

class Client
{
    public readonly Emails $emails;

    public function __construct(
        string $apiKey,
        ?string $baseUrl = null,
        ?HttpTransport $transport = null,
    ) {
        $normalizedApiKey = $this->normalizeApiKey($apiKey);
        $normalizedBaseUrl = $this->normalizeBaseUrl($baseUrl ?? Constants::DEFAULT_BASE_URL);
        $http = new HttpClient($normalizedApiKey, $normalizedBaseUrl, $transport ?? new StreamHttpTransport());
        $this->emails = new Emails($http);
    }

    private function normalizeApiKey(string $apiKey): string
    {
        $apiKey = trim($apiKey);
        if ($apiKey === '') {
            throw new InvalidArgumentException('API key is required.');
        }

        return $apiKey;
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        $baseUrl = trim($baseUrl);
        if ($baseUrl === '' || filter_var($baseUrl, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('baseUrl must be a valid absolute http or https URL.');
        }

        $scheme = strtolower((string) parse_url($baseUrl, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException('baseUrl must use http or https.');
        }

        return rtrim($baseUrl, '/');
    }
}
