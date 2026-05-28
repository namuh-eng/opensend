<?php

declare(strict_types=1);

namespace OpenSend\Contracts;

use OpenSend\Http\HttpResponse;

interface HttpTransport
{
    /**
     * @param array<string, string> $headers
     */
    public function send(string $method, string $url, array $headers, ?string $body): HttpResponse;
}
