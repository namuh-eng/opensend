<?php

declare(strict_types=1);

namespace OpenSend\Errors;

use RuntimeException;
use Throwable;

final class ApiException extends RuntimeException
{
    /**
     * @param array<string, mixed>|null $details
     */
    public function __construct(
        string $message,
        private readonly int $statusCode,
        private readonly ?string $name = null,
        private readonly ?string $errorCode = null,
        private readonly ?array $details = null,
        private readonly ?string $rawBody = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $statusCode, $previous);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function name(): ?string
    {
        return $this->name;
    }

    public function errorCode(): ?string
    {
        return $this->errorCode;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function details(): ?array
    {
        return $this->details;
    }

    public function rawBody(): ?string
    {
        return $this->rawBody;
    }
}
