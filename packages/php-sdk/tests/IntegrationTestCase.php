<?php

declare(strict_types=1);

namespace OpenSend\Tests;

use PHPUnit\Framework\TestCase;

abstract class IntegrationTestCase extends TestCase
{
    protected string $baseUrl;
    private string $tempDir;
    private string $responsePath;
    private string $recordPath;

    /** @var resource|null */
    private $process = null;

    /** @var array<int, resource> */
    private array $pipes = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->tempDir = sys_get_temp_dir() . '/opensend-php-sdk-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0700, true);
        $this->responsePath = $this->tempDir . '/response.json';
        $this->recordPath = $this->tempDir . '/requests.jsonl';
        $this->setServerResponse(200, ['id' => 'email_default']);
        file_put_contents($this->recordPath, '');

        $port = $this->reservePort();
        $this->baseUrl = 'http://127.0.0.1:' . $port;

        $router = __DIR__ . '/Fixtures/router.php';
        $command = escapeshellarg(PHP_BINARY) . ' -S 127.0.0.1:' . $port . ' ' . escapeshellarg($router);
        $this->process = proc_open(
            $command,
            [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ],
            $this->pipes,
            dirname(__DIR__),
            [
                'OPENSEND_TEST_RESPONSE_PATH' => $this->responsePath,
                'OPENSEND_TEST_RECORD_PATH' => $this->recordPath,
            ],
        );

        if (!is_resource($this->process)) {
            self::fail('Failed to start PHP test server.');
        }

        $this->waitForServer($port);
    }

    protected function tearDown(): void
    {
        if (is_resource($this->process)) {
            proc_terminate($this->process);
            proc_close($this->process);
        }
        foreach ($this->pipes as $pipe) {
            if (is_resource($pipe)) {
                fclose($pipe);
            }
        }
        $this->removeDirectory($this->tempDir);

        parent::tearDown();
    }

    /**
     * @param array<string, mixed> $body
     * @param array<string, string> $headers
     */
    protected function setServerResponse(int $status, array $body, array $headers = []): void
    {
        file_put_contents($this->responsePath, json_encode([
            'status' => $status,
            'body' => $body,
            'headers' => $headers,
        ], JSON_THROW_ON_ERROR));
    }


    /**
     * @param array<string, string> $headers
     */
    protected function setRawServerResponse(int $status, string $rawBody, string $contentType = 'application/json', array $headers = []): void
    {
        file_put_contents($this->responsePath, json_encode([
            'status' => $status,
            'rawBody' => $rawBody,
            'contentType' => $contentType,
            'headers' => $headers,
        ], JSON_THROW_ON_ERROR));
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function recordedRequests(): array
    {
        $contents = trim((string) file_get_contents($this->recordPath));
        if ($contents === '') {
            return [];
        }

        return array_map(
            static fn (string $line): array => json_decode($line, true, 512, JSON_THROW_ON_ERROR),
            explode(PHP_EOL, $contents),
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function lastRequest(): array
    {
        $requests = $this->recordedRequests();
        self::assertNotEmpty($requests);

        return $requests[array_key_last($requests)];
    }

    private function reservePort(): int
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        if ($socket === false) {
            self::fail('Failed to reserve a test server port: ' . $errstr);
        }

        $name = stream_socket_get_name($socket, false);
        fclose($socket);
        if (!is_string($name) || !str_contains($name, ':')) {
            self::fail('Failed to discover reserved test server port.');
        }

        return (int) substr(strrchr($name, ':'), 1);
    }

    private function waitForServer(int $port): void
    {
        $deadline = microtime(true) + 5;
        do {
            $socket = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
            if (is_resource($socket)) {
                fclose($socket);
                return;
            }
            usleep(50_000);
        } while (microtime(true) < $deadline);

        self::fail('PHP test server did not start on port ' . $port . '.');
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }
        foreach (scandir($path) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $file = $path . DIRECTORY_SEPARATOR . $entry;
            is_dir($file) ? $this->removeDirectory($file) : unlink($file);
        }
        rmdir($path);
    }
}
