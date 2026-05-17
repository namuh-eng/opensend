# Introduction

Core concepts for the OpenSend API.

OpenSend is a REST API for sending, receiving, and operating email on infrastructure you control.

## Base URL

```txt
https://opensend.namuh.co
```

For local development, use the port configured by your app, usually:

```txt
http://localhost:3015
```


## Authentication

Use an OpenSend API key in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

Dashboard session cookies are not API credentials.


## Response codes

- `200` / `201` / `202` — request accepted or completed.
- `400` — malformed request or invalid state.
- `401` — missing API key.
- `403` — API key lacks the required permission.
- `404` — resource not found for the authenticated tenant.
- `409` — idempotency or conflict error.
- `422` — validation error.
- `429` — rate limit exceeded.
- `500` — server error.

## Machine-readable contracts

- OpenAPI: `/openapi.json`
- LLM docs index: `/docs/llms.txt`
