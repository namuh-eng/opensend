# Send emails with Java and Kotlin

Use the first-party OpenSend JVM SDK from plain Java, Kotlin, Spring Boot services, workers, and command-line applications. The package lives in this repository at `packages/jvm-sdk` while registry publishing is prepared. This is a partial, blocking-only SDK for emails, contacts, domains, and suppressions; use the REST API and `/openapi.json` for other resources.

The JVM SDK targets OpenSend Cloud by default at `https://opensend.namuh.co` and can point at self-hosted OpenSend by setting `OPENSEND_BASE_URL`.

## Support level

This JVM package is intentionally narrower than the full OpenSend REST API. It currently wraps:

- `emails`: `POST /emails`, `POST /emails/batch`, `GET /api/emails`, `GET /api/emails/{id}`, `POST /emails/{id}/cancel`
- `contacts`: `POST /contacts`, `GET /contacts`, `GET /contacts/{id}`, `PATCH /contacts/{id}`, `DELETE /contacts/{id}`
- `domains`: `POST /api/domains`, `GET /api/domains`, `GET /api/domains/{id}`, `PATCH /api/domains/{id}`, `POST /api/domains/{id}/verify`, `DELETE /api/domains/{id}`
- `suppressions`: `POST /api/suppressions`, `GET /api/suppressions`, `GET /api/suppressions/{email}`, `DELETE /api/suppressions/{email}`

It does not expose JVM methods for API keys, broadcasts, audiences, segments,
topics, templates, webhooks, logs, contact properties, events, automations,
receiving, dedicated IPs, or unsubscribe-page settings yet.

## Install from the repository

Build and install the local Maven artifact:

```bash
cd packages/jvm-sdk
mvn test
mvn install
```

Then add the local dependency:

```xml
<dependency>
  <groupId>com.opensend</groupId>
  <artifactId>opensend-java</artifactId>
  <version>0.1.0-SNAPSHOT</version>
</dependency>
```

No registry credentials or publishing secrets are required for the repository-local package.

## Blocking vs async

The first JVM SDK slice is **blocking-only**. It uses Java's built-in `HttpClient#send` and exposes straightforward resource methods such as `client.emails().send(...)`. This is the recommended stance for Spring Boot controllers, services, queue workers, and CLIs.

Async methods are not exposed yet. If you need asynchronous execution today, run the blocking call inside your application's existing executor, job queue, coroutine dispatcher, or virtual-thread strategy.

## Send from Java

```java
import com.opensend.ApiException;
import com.opensend.OpenSend;
import com.opensend.RequestOptions;
import com.opensend.models.EmailResponse;
import com.opensend.models.SendEmailRequest;
import java.util.List;

OpenSend client = OpenSend.builder(System.getenv("OPENSEND_API_KEY"))
    .baseUrl(System.getenv().getOrDefault("OPENSEND_BASE_URL", OpenSend.DEFAULT_BASE_URL))
    .build();

try {
  EmailResponse email = client.emails().send(
      SendEmailRequest.builder()
          .from("OpenSend <onboarding@updates.example.com>")
          .to(List.of("user@example.com"))
          .subject("Hello from OpenSend")
          .html("<strong>It works.</strong>")
          .build(),
      RequestOptions.withIdempotencyKey("welcome-user-123"));
  System.out.println(email.id());
} catch (ApiException error) {
  System.err.println(error.statusCode() + " " + error.apiMessage());
  throw error;
}
```

## Send from Kotlin

```kotlin
import com.opensend.OpenSend
import com.opensend.RequestOptions
import com.opensend.models.SendEmailRequest

val client = OpenSend.builder(System.getenv("OPENSEND_API_KEY"))
    .baseUrl(System.getenv("OPENSEND_BASE_URL") ?: OpenSend.DEFAULT_BASE_URL)
    .build()

val email = client.emails().send(
    SendEmailRequest.builder()
        .from("OpenSend <onboarding@updates.example.com>")
        .to(listOf("user@example.com"))
        .subject("Hello from OpenSend")
        .html("<strong>It works.</strong>")
        .build(),
    RequestOptions.withIdempotencyKey("welcome-user-123"),
)
println(email.id())
```

## Spring Boot pattern

Create the client once as a singleton bean:

```java
@Bean
OpenSend openSend(@Value("${opensend.api-key}") String apiKey,
                  @Value("${opensend.base-url:https://opensend.namuh.co}") String baseUrl) {
  return OpenSend.builder(apiKey).baseUrl(baseUrl).build();
}
```

Inject `OpenSend` into services and use idempotency keys for retryable send paths.

## Errors and rate limits

Non-2xx API responses throw `ApiException`. The exception preserves the OpenSend error envelope where present:

- `statusCode()`
- `apiMessage()`
- `name()`
- `code()`
- `details()`
- `body()`
- `rateLimit()` with `limit`, `remaining`, `reset`, and `retryAfter` header values when the server returns them

Use `RequestOptions.withIdempotencyKey(...)` on supported write methods such as email sends and suppression creation when your application retries after timeouts or queue restarts.

## Supported routes

This SDK slice only wraps implemented OpenSend routes:

- `emails`: `POST /emails`, `POST /emails/batch`, `GET /api/emails`, `GET /api/emails/{id}`, `POST /emails/{id}/cancel`
- `contacts`: `POST /contacts`, `GET /contacts`, `GET /contacts/{id}`, `PATCH /contacts/{id}`, `DELETE /contacts/{id}`
- `domains`: `POST /api/domains`, `GET /api/domains`, `GET /api/domains/{id}`, `PATCH /api/domains/{id}`, `POST /api/domains/{id}/verify`, `DELETE /api/domains/{id}`
- `suppressions`: `POST /api/suppressions`, `GET /api/suppressions`, `GET /api/suppressions/{email}`, `DELETE /api/suppressions/{email}`

Use `/openapi.json` or the REST API docs for resources not exposed by this first SDK slice.
