<?php

declare(strict_types=1);

namespace OpenSend\Resources;

use OpenSend\Http\HttpClient;
use OpenSend\ValueObjects\EmailResponse;
use OpenSend\ValueObjects\RequestOptions;
use OpenSend\ValueObjects\SendEmailRequest;

final class Emails
{
    public function __construct(private readonly HttpClient $http)
    {
    }

    /**
     * @param SendEmailRequest|array<string, mixed> $request
     */
    public function send(SendEmailRequest|array $request, ?RequestOptions $options = null): EmailResponse
    {
        $payload = $request instanceof SendEmailRequest
            ? $request->toArray()
            : SendEmailRequest::fromArray($request)->toArray();

        return EmailResponse::fromArray($this->http->request('POST', '/emails', $payload, $options));
    }
}
