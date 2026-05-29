package com.opensend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.opensend.fixtures.RecordedRequest;
import com.opensend.fixtures.TestServer;
import com.opensend.models.SendEmailRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

final class OpenSendClientTest {
  @Test
  void requiresApiKey() {
    assertThrows(IllegalArgumentException.class, () -> OpenSend.create(" "));
  }

  @Test
  void rejectsInvalidBaseUrl() {
    assertThrows(IllegalArgumentException.class, () -> OpenSend.builder("os_test").baseUrl("ftp://example.com").build());
  }

  @Test
  void sendsDefaultHeadersAndJoinsBasePath() throws Exception {
    try (TestServer server = new TestServer()) {
      server.respond(exchange -> new TestServer.StubResponse(200, "{\"id\":\"email_123\"}"));
      OpenSend client = OpenSend.builder(" os_test ").baseUrl(server.url() + "/v1/").build();

      client.emails().send(SendEmailRequest.builder()
          .from("OpenSend <onboarding@example.com>")
          .to(List.of("user@example.com"))
          .subject("Hello")
          .html("<strong>Hello</strong>")
          .build(), RequestOptions.withIdempotencyKey("welcome-123"));

      RecordedRequest request = server.takeRequest();
      assertEquals("POST", request.method());
      assertEquals("/v1/emails", request.path());
      assertEquals("Bearer os_test", request.firstHeader("Authorization"));
      assertEquals("application/json", request.firstHeader("Accept"));
      assertEquals("application/json", request.firstHeader("Content-Type"));
      assertEquals("welcome-123", request.firstHeader("Idempotency-Key"));
      assertEquals("opensend-jvm/0.1.0", request.firstHeader("User-Agent"));
    }
  }
}
