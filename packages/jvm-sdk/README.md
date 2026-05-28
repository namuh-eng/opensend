# OpenSend JVM SDK

First-party Java/Kotlin-compatible SDK for OpenSend. This v1 staging slice is intentionally narrow and handwritten so it stays reviewable while OpenSend's OpenAPI/client-generation story matures.

## Install from this repository

```bash
cd packages/jvm-sdk
mvn test
mvn install
```

Then depend on the local Maven artifact:

```xml
<dependency>
  <groupId>com.opensend</groupId>
  <artifactId>opensend-java</artifactId>
  <version>0.1.0-SNAPSHOT</version>
</dependency>
```

No registry credentials or publishing secrets are checked in. Public Maven Central publishing is intentionally out of scope for this slice.

## Client stance

The SDK is **blocking-only** in this first slice. It uses Java's `java.net.http.HttpClient#send` under the hood, which keeps the API predictable for Spring Boot services, workers, and command-line applications. Async wrappers are deferred until OpenSend can commit to a stable async API across SDKs.

## Supported API surface

This package only exposes routes implemented in this repository:

- `emails`: send, batch send, list, retrieve, cancel
- `contacts`: create, list, retrieve, update, delete
- `domains`: create, list, retrieve, update, verify, delete
- `suppressions`: create, list, retrieve, delete

Use the REST API or another first-party SDK for resources not listed here.

## Java

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
  error.rateLimit().retryAfter().ifPresent(retryAfter ->
      System.err.println("Retry after " + retryAfter + " seconds"));
  throw error;
}
```

## Kotlin

```kotlin
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

## Spring Boot

Create the client once as a singleton bean and keep credentials in environment-backed configuration:

```java
@Bean
OpenSend openSend(@Value("${opensend.api-key}") String apiKey,
                  @Value("${opensend.base-url:https://opensend.namuh.co}") String baseUrl) {
  return OpenSend.builder(apiKey).baseUrl(baseUrl).build();
}
```

Inject `OpenSend` into services and call `client.emails().send(...)` from controllers, jobs, or queue workers. Do not expose the API key to browser/mobile clients.
