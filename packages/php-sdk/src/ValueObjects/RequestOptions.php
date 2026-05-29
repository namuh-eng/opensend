<?php

declare(strict_types=1);

namespace OpenSend\ValueObjects;

use InvalidArgumentException;

final class RequestOptions
{
    public function __construct(
        public readonly ?string $idempotencyKey = null,
    ) {
        if ($idempotencyKey !== null) {
            $length = strlen($idempotencyKey);
            if ($length < 1 || $length > 256) {
                throw new InvalidArgumentException('idempotencyKey must be between 1 and 256 characters.');
            }
        }
    }

    public static function withIdempotencyKey(string $idempotencyKey): self
    {
        return new self($idempotencyKey);
    }
}
