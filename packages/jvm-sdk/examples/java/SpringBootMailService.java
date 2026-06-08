import com.opensend.OpenSend;
import com.opensend.RequestOptions;
import com.opensend.models.EmailResponse;
import com.opensend.models.SendEmailRequest;
import java.util.List;

// Support level: the JVM SDK is currently a partial, blocking client for
// emails, contacts, domains, and suppressions. Use the REST API and
// /openapi.json for other OpenSend resources until JVM resource clients are
// added.
final class SpringBootMailService {
  private final OpenSend openSend;

  SpringBootMailService(String apiKey, String baseUrl) {
    this.openSend = OpenSend.builder(apiKey)
        .baseUrl(baseUrl == null || baseUrl.isBlank() ? OpenSend.DEFAULT_BASE_URL : baseUrl)
        .build();
  }

  EmailResponse sendWelcome(String email, String idempotencyKey) {
    return openSend.emails().send(
        SendEmailRequest.builder()
            .from("OpenSend <onboarding@updates.example.com>")
            .to(List.of(email))
            .subject("Welcome")
            .html("<strong>Welcome.</strong>")
            .build(),
        RequestOptions.withIdempotencyKey(idempotencyKey));
  }
}
