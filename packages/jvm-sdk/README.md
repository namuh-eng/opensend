# OpenSend JVM SDK

First-party Java/Kotlin-compatible SDK for OpenSend. This v1 staging slice is intentionally narrow and handwritten so it stays reviewable while OpenSend's OpenAPI/client-generation story matures.

## Support level

This is a **partial, blocking-only JVM SDK**. Before copying examples, note
that this package currently wraps only:

- `emails`: send, batch send, list, retrieve, cancel
- `contacts`: create, list, retrieve, update, delete
- `domains`: create, list, retrieve, update, verify, delete
- `suppressions`: create, list, retrieve, delete

Other public OpenSend resources, including API keys, broadcasts, segments,
topics, templates, webhooks, logs, contact properties, events, automations,
receiving, dedicated IPs, and unsubscribe-page settings, are available through
the REST API and `/openapi.json`, but they are **not** exposed by this JVM
package yet.

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

This package only exposes routes implemented in this repository and listed above:

- `emails`: send, batch send, list, retrieve, cancel
- `contacts`: create, list, retrieve, update, delete
- `domains`: create, list, retrieve, update, verify, delete
- `suppressions`: create, list, retrieve, delete

Use the REST API or another first-party SDK for resources not listed here. Do
not assume a route in `/openapi.json` has a corresponding JVM method until it
appears in this README and in
`packages/jvm-sdk/src/main/java/com/opensend/resources`.

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
