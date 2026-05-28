package com.opensend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.opensend.fixtures.RecordedRequest;
import com.opensend.fixtures.TestServer;
import com.opensend.models.CreateContactRequest;
import com.opensend.models.CreateDomainRequest;
import com.opensend.models.CreateSuppressionRequest;
import com.opensend.models.EmailListItem;
import com.opensend.models.EmailListOptions;
import com.opensend.models.EmailResponse;
import com.opensend.models.SendEmailRequest;
import com.opensend.models.SuppressionReason;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

final class ResourceContractTest {
  @Test
  void emailsSendAndListUseImplementedRoutes() throws Exception {
    try (TestServer server = new TestServer()) {
      server.respond(exchange -> switch (exchange.getRequestURI().getPath()) {
        case "/emails" -> new TestServer.StubResponse(200, "{\"id\":\"email_123\"}");
        case "/api/emails" -> new TestServer.StubResponse(200, "{\"object\":\"list\",\"has_more\":false,\"data\":[{\"id\":\"email_123\",\"from\":\"OpenSend <onboarding@example.com>\",\"to\":[\"user@example.com\"],\"subject\":\"Hello\",\"last_event\":\"queued\",\"created_at\":\"2026-05-28T00:00:00Z\"}]}");
        default -> new TestServer.StubResponse(404, "{}");
      });
      OpenSend client = OpenSend.builder("os_test").baseUrl(server.url()).build();

      EmailResponse sent = client.emails().send(SendEmailRequest.builder()
          .from("OpenSend <onboarding@example.com>")
          .to(List.of("user@example.com"))
          .subject("Hello")
          .html("<strong>Hello</strong>")
          .build());
      ListPage<EmailListItem> page = client.emails().list(new EmailListOptions(20, "email_100", null, "queued"));

      assertEquals("email_123", sent.id());
      assertFalse(page.hasMore());
      assertEquals("email_123", page.data().get(0).id());
      RecordedRequest sendRequest = server.takeRequest();
      RecordedRequest listRequest = server.takeRequest();
      assertEquals("/emails", sendRequest.path());
      assertEquals("/api/emails?limit=20&after=email_100&status=queued", listRequest.path());
    }
  }

  @Test
  void representativeResourcesUseDocumentedImplementedRoutes() throws Exception {
    try (TestServer server = new TestServer()) {
      server.respond(exchange -> switch (exchange.getRequestURI().getPath()) {
        case "/contacts" -> new TestServer.StubResponse(200, "{\"object\":\"contact\",\"id\":\"contact_123\",\"email\":\"user@example.com\",\"properties\":{\"plan\":\"pro\"},\"created_at\":\"2026-05-28T00:00:00Z\"}");
        case "/api/domains" -> new TestServer.StubResponse(200, "{\"object\":\"domain\",\"id\":\"domain_123\",\"name\":\"example.com\",\"status\":\"pending\",\"region\":\"us-east-1\",\"records\":[],\"created_at\":\"2026-05-28T00:00:00Z\"}");
        case "/api/suppressions" -> new TestServer.StubResponse(200, "{\"object\":\"suppression\",\"id\":\"sup_123\",\"email\":\"user@example.com\",\"reason\":\"manual\",\"scope\":\"user\",\"suppressed_at\":\"2026-05-28T00:00:00Z\",\"updated_at\":\"2026-05-28T00:00:00Z\"}");
        default -> new TestServer.StubResponse(404, "{}");
      });
      OpenSend client = OpenSend.builder("os_test").baseUrl(server.url()).build();

      assertEquals("contact_123", client.contacts().create(new CreateContactRequest("user@example.com", null, null, Map.of("plan", "pro"), List.of())).id());
      assertEquals("domain_123", client.domains().create(new CreateDomainRequest("example.com", null, null, null, null, null, null, List.of())).id());
      assertEquals("sup_123", client.suppressions().create(new CreateSuppressionRequest("user@example.com", SuppressionReason.manual), RequestOptions.withIdempotencyKey("suppress-user")).id());

      assertEquals("/contacts", server.takeRequest().path());
      assertEquals("/api/domains", server.takeRequest().path());
      RecordedRequest suppressionRequest = server.takeRequest();
      assertEquals("/api/suppressions", suppressionRequest.path());
      assertEquals("suppress-user", suppressionRequest.firstHeader("Idempotency-Key"));
    }
  }
}
