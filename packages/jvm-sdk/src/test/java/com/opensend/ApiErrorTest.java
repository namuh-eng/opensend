package com.opensend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.opensend.fixtures.TestServer;
import com.opensend.models.SendEmailRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

final class ApiErrorTest {
  @Test
  void parsesOpenSendErrorEnvelopeAndRateLimitHeaders() throws Exception {
    try (TestServer server = new TestServer()) {
      Map<String, String> headers = new LinkedHashMap<>();
      headers.put("x-ratelimit-limit", "10");
      headers.put("x-ratelimit-remaining", "0");
      headers.put("retry-after", "30");
      server.respond(exchange -> new TestServer.StubResponse(
          422,
          "{\"name\":\"validation_error\",\"code\":\"invalid_request\",\"message\":\"from is required\",\"details\":{\"fieldErrors\":{\"from\":[\"Required\"]}}}",
          headers));
      OpenSend client = OpenSend.builder("os_test").baseUrl(server.url()).build();

      ApiException error = assertThrows(ApiException.class, () -> client.emails().send(SendEmailRequest.builder()
          .to(List.of("user@example.com"))
          .subject("Hello")
          .build()));

      assertEquals(422, error.statusCode());
      assertEquals("from is required", error.apiMessage());
      assertEquals("validation_error", error.name());
      assertEquals("invalid_request", error.code());
      assertNotNull(error.details());
      assertEquals(10, error.rateLimit().limit().orElseThrow());
      assertEquals(0, error.rateLimit().remaining().orElseThrow());
      assertEquals("30", error.rateLimit().retryAfter().orElseThrow());
    }
  }

  @Test
  void keepsRawBodyForUnexpectedErrorShapes() throws Exception {
    try (TestServer server = new TestServer()) {
      server.respond(exchange -> new TestServer.StubResponse(500, "upstream unavailable"));
      OpenSend client = OpenSend.builder("os_test").baseUrl(server.url()).build();

      ApiException error = assertThrows(ApiException.class, () -> client.domains().list());

      assertEquals(500, error.statusCode());
      assertEquals("upstream unavailable", error.body());
      assertTrue(error.getMessage().contains("Request failed"));
    }
  }
}
