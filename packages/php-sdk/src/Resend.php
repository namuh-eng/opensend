<?php

declare(strict_types=1);

namespace OpenSend;

use OpenSend\Contracts\HttpTransport;

final class Resend extends Client
{
    public function __construct(string $apiKey, ?string $baseUrl = null, ?HttpTransport $transport = null)
    {
        parent::__construct($apiKey, $baseUrl, $transport);
    }
}
