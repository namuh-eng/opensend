<?php

declare(strict_types=1);

namespace OpenSend\ValueObjects;

use UnexpectedValueException;

final class EmailResponse
{
    /**
     * @param array<string, mixed> $raw
     */
    public function __construct(
        public readonly string $id,
        private readonly array $raw = [],
    ) {
        if (trim($id) === '') {
            throw new UnexpectedValueException('OpenSend email response did not include a non-empty id.');
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function fromArray(array $payload): self
    {
        $id = $payload['id'] ?? null;
        if (!is_string($id)) {
            throw new UnexpectedValueException('OpenSend email response did not include a string id.');
        }

        return new self($id, $payload);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return $this->raw === [] ? ['id' => $this->id] : $this->raw;
    }
}
