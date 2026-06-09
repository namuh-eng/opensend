<?php

declare(strict_types=1);

$responsePath = getenv('OPENSEND_TEST_RESPONSE_PATH');
$recordPath = getenv('OPENSEND_TEST_RECORD_PATH');

if (!is_string($responsePath) || !is_string($recordPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'test server not configured']);
    return;
}

$body = file_get_contents('php://input') ?: '';
$decodedBody = null;
if ($body !== '') {
    $decodedBody = json_decode($body, true);
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$normalizedHeaders = [];
foreach ($headers as $name => $value) {
    $normalizedHeaders[strtolower((string) $name)] = (string) $value;
}

$record = [
    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
    'path' => parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH),
    'query' => $_GET,
    'headers' => $normalizedHeaders,
    'rawBody' => $body,
    'jsonBody' => $decodedBody,
];
file_put_contents($recordPath, json_encode($record, JSON_THROW_ON_ERROR) . PHP_EOL, FILE_APPEND | LOCK_EX);

$response = json_decode((string) file_get_contents($responsePath), true);
if (!is_array($response)) {
    $response = ['status' => 200, 'body' => []];
}

http_response_code((int) ($response['status'] ?? 200));
foreach (($response['headers'] ?? []) as $name => $value) {
    header((string) $name . ': ' . (string) $value);
}
header('Content-Type: ' . (string) ($response['contentType'] ?? 'application/json'));
if (array_key_exists('rawBody', $response)) {
    echo (string) $response['rawBody'];
    return;
}
echo json_encode($response['body'] ?? [], JSON_THROW_ON_ERROR);
