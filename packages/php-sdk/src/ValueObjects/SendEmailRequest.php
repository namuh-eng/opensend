<?php

declare(strict_types=1);

namespace OpenSend\ValueObjects;

use InvalidArgumentException;

final class SendEmailRequest
{
    /**
     * @param string|list<string> $to
     * @param string|list<string>|null $cc
     * @param string|list<string>|null $bcc
     * @param string|list<string>|null $replyTo
     * @param array<string, string>|null $headers
     * @param list<array<string, mixed>>|null $attachments
     * @param list<array{name: string, value: string}>|null $tags
     * @param array{id: string, variables?: array<string, mixed>}|null $template
     */
    public function __construct(
        public readonly string $from,
        public readonly string|array $to,
        public readonly string $subject,
        public readonly ?string $html = null,
        public readonly ?string $text = null,
        public readonly string|array|null $cc = null,
        public readonly string|array|null $bcc = null,
        public readonly string|array|null $replyTo = null,
        public readonly ?array $headers = null,
        public readonly ?array $attachments = null,
        public readonly ?array $tags = null,
        public readonly ?string $scheduledAt = null,
        public readonly ?string $topicId = null,
        public readonly ?array $template = null,
    ) {
        self::assertNonEmptyString($from, 'from');
        self::assertRecipient($to, 'to');
        self::assertNonEmptyString($subject, 'subject');

        if (($html === null || $html === '') && ($text === null || $text === '') && $template === null) {
            throw new InvalidArgumentException('html, text, or template is required.');
        }

        if ($cc !== null) {
            self::assertRecipient($cc, 'cc');
        }
        if ($bcc !== null) {
            self::assertRecipient($bcc, 'bcc');
        }
        if ($replyTo !== null) {
            self::assertRecipient($replyTo, 'replyTo');
        }
        if ($headers !== null) {
            foreach ($headers as $name => $value) {
                self::assertNonEmptyString((string) $name, 'headers key');
                self::assertStringValue($value, 'headers.' . $name);
            }
        }
        if ($tags !== null && count($tags) > 75) {
            throw new InvalidArgumentException('tags may contain at most 75 entries.');
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function fromArray(array $payload): self
    {
        $replyTo = $payload['reply_to'] ?? $payload['replyTo'] ?? null;
        $scheduledAt = $payload['scheduled_at'] ?? $payload['scheduledAt'] ?? null;
        $topicId = $payload['topic_id'] ?? $payload['topicId'] ?? null;

        return new self(
            from: self::stringField($payload, 'from'),
            to: self::requiredRecipientField($payload, 'to'),
            subject: self::stringField($payload, 'subject'),
            html: self::optionalString($payload['html'] ?? null, 'html'),
            text: self::optionalString($payload['text'] ?? null, 'text'),
            cc: self::optionalRecipient($payload['cc'] ?? null, 'cc'),
            bcc: self::optionalRecipient($payload['bcc'] ?? null, 'bcc'),
            replyTo: self::optionalRecipient($replyTo, 'replyTo'),
            headers: self::optionalArray($payload['headers'] ?? null, 'headers'),
            attachments: self::optionalArray($payload['attachments'] ?? null, 'attachments'),
            tags: self::optionalArray($payload['tags'] ?? null, 'tags'),
            scheduledAt: self::optionalString($scheduledAt, 'scheduledAt'),
            topicId: self::optionalString($topicId, 'topicId'),
            template: self::optionalArray($payload['template'] ?? null, 'template'),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $payload = [
            'from' => $this->from,
            'to' => $this->to,
            'subject' => $this->subject,
        ];

        $this->putIfNotNull($payload, 'html', $this->html);
        $this->putIfNotNull($payload, 'text', $this->text);
        $this->putIfNotNull($payload, 'cc', $this->cc);
        $this->putIfNotNull($payload, 'bcc', $this->bcc);
        $this->putIfNotNull($payload, 'reply_to', $this->replyTo);
        $this->putIfNotNull($payload, 'headers', $this->headers);
        $this->putIfNotNull($payload, 'attachments', $this->attachments);
        $this->putIfNotNull($payload, 'tags', $this->tags);
        $this->putIfNotNull($payload, 'scheduled_at', $this->scheduledAt);
        $this->putIfNotNull($payload, 'topic_id', $this->topicId);
        $this->putIfNotNull($payload, 'template', $this->template);

        return $payload;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function putIfNotNull(array &$payload, string $key, mixed $value): void
    {
        if ($value !== null) {
            $payload[$key] = $value;
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function stringField(array $payload, string $key): string
    {
        if (!array_key_exists($key, $payload)) {
            throw new InvalidArgumentException($key . ' is required.');
        }

        return self::optionalString($payload[$key], $key) ?? '';
    }

    /**
     * @param array<string, mixed> $payload
     * @return string|list<string>
     */
    private static function requiredRecipientField(array $payload, string $key): string|array
    {
        if (!array_key_exists($key, $payload)) {
            throw new InvalidArgumentException($key . ' is required.');
        }

        return self::optionalRecipient($payload[$key], $key) ?? '';
    }

    private static function optionalString(mixed $value, string $field): ?string
    {
        if ($value === null) {
            return null;
        }
        self::assertStringValue($value, $field);

        return $value;
    }

    /**
     * @return string|list<string>|null
     */
    private static function optionalRecipient(mixed $value, string $field): string|array|null
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value)) {
            self::assertNonEmptyString($value, $field);

            return $value;
        }
        if (is_array($value)) {
            if ($value === []) {
                throw new InvalidArgumentException($field . ' must not be empty.');
            }
            foreach ($value as $recipient) {
                self::assertNonEmptyString($recipient, $field);
            }

            return array_values($value);
        }

        throw new InvalidArgumentException($field . ' must be a string or a list of strings.');
    }

    /**
     * @return array<mixed>|null
     */
    private static function optionalArray(mixed $value, string $field): ?array
    {
        if ($value === null) {
            return null;
        }
        if (!is_array($value)) {
            throw new InvalidArgumentException($field . ' must be an array.');
        }

        return $value;
    }

    private static function assertRecipient(string|array $value, string $field): void
    {
        self::optionalRecipient($value, $field);
    }

    private static function assertStringValue(mixed $value, string $field): void
    {
        if (!is_string($value)) {
            throw new InvalidArgumentException($field . ' must be a string.');
        }
    }

    private static function assertNonEmptyString(mixed $value, string $field): void
    {
        self::assertStringValue($value, $field);
        if (trim($value) === '') {
            throw new InvalidArgumentException($field . ' must be a non-empty string.');
        }
    }
}
