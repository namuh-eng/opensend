<?php

declare(strict_types=1);

namespace OpenSend\Tests;

use InvalidArgumentException;
use OpenSend\Client;
use OpenSend\Errors\ApiException;
use OpenSend\ValueObjects\RequestOptions;
use OpenSend\ValueObjects\SendEmailRequest;

final class EmailsTest extends IntegrationTestCase
{
    public function testSendPostsEmailRequestWithAuthAndIdempotencyHeaders(): void
    {
        $this->setServerResponse(200, ['id' => 'email_123']);
        $client = new Client('os_test_key', $this->baseUrl);

        $response = $client->emails->send(
            new SendEmailRequest(
                from: 'OpenSend <hello@example.com>',
                to: ['user@example.com'],
                subject: 'Welcome',
                html: '<p>Hello</p>',
                replyTo: 'support@example.com',
                tags: [['name' => 'flow', 'value' => 'signup']],
            ),
            RequestOptions::withIdempotencyKey('welcome-user-123'),
        );

        self::assertSame('email_123', $response->id);
        $request = $this->lastRequest();
        self::assertSame('POST', $request['method']);
        self::assertSame('/emails', $request['path']);
        self::assertSame('Bearer os_test_key', $request['headers']['authorization']);
        self::assertSame('application/json', $request['headers']['content-type']);
        self::assertSame('welcome-user-123', $request['headers']['idempotency-key']);
        self::assertSame('OpenSend <hello@example.com>', $request['jsonBody']['from']);
        self::assertSame(['user@example.com'], $request['jsonBody']['to']);
        self::assertSame('support@example.com', $request['jsonBody']['reply_to']);
        self::assertArrayNotHasKey('replyTo', $request['jsonBody']);
    }

    public function testSendAcceptsArrayPayloadAliases(): void
    {
        $this->setServerResponse(200, ['id' => 'email_alias']);
        $client = new Client('os_test_key', $this->baseUrl);

        $response = $client->emails->send([
            'from' => 'hello@example.com',
            'to' => 'user@example.com',
            'subject' => 'Alias',
            'text' => 'Hello',
            'replyTo' => ['reply@example.com'],
            'scheduledAt' => '2026-06-01T00:00:00.000Z',
        ]);

        self::assertSame('email_alias', $response->id);
        $request = $this->lastRequest();
        self::assertSame(['reply@example.com'], $request['jsonBody']['reply_to']);
        self::assertSame('2026-06-01T00:00:00.000Z', $request['jsonBody']['scheduled_at']);
    }

    public function testErrorEnvelopeThrowsTypedApiException(): void
    {
        $this->setServerResponse(422, [
            'name' => 'validation_error',
            'code' => 'validation_error',
            'message' => 'html, text, or template is required',
            'statusCode' => 422,
            'details' => [
                'formErrors' => [],
                'fieldErrors' => ['html' => ['html, text, or template is required']],
            ],
        ]);
        $client = new Client('os_test_key', $this->baseUrl);

        try {
            $client->emails->send([
                'from' => 'hello@example.com',
                'to' => 'user@example.com',
                'subject' => 'Server validation',
                'html' => '<p>Client allows this so the server response is exercised.</p>',
            ]);
            self::fail('Expected ApiException to be thrown.');
        } catch (ApiException $exception) {
            self::assertSame(422, $exception->statusCode());
            self::assertSame('validation_error', $exception->name());
            self::assertSame('validation_error', $exception->errorCode());
            self::assertSame('html, text, or template is required', $exception->getMessage());
            self::assertSame(['html' => ['html, text, or template is required']], $exception->details()['fieldErrors']);
        }
    }

    public function testLocalValidationRejectsIncompleteSendPayloadBeforeNetwork(): void
    {
        $client = new Client('os_test_key', $this->baseUrl);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('html, text, or template is required.');

        $client->emails->send([
            'from' => 'hello@example.com',
            'to' => 'user@example.com',
            'subject' => 'No body',
        ]);
    }

    public function testInvalidJsonResponseMapsToParseError(): void
    {
        $this->setRawServerResponse(200, '{not-json', 'application/json');
        $client = new Client('os_test_key', $this->baseUrl);

        $this->expectException(ApiException::class);
        $this->expectExceptionMessage('Invalid JSON response from OpenSend.');

        $client->emails->send([
            'from' => 'hello@example.com',
            'to' => 'user@example.com',
            'subject' => 'Bad JSON',
            'text' => 'Hello',
        ]);
    }

}