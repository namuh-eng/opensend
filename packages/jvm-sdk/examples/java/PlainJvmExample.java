import com.opensend.ApiException;
import com.opensend.OpenSend;
import com.opensend.RequestOptions;
import com.opensend.models.EmailResponse;
import com.opensend.models.SendEmailRequest;
import java.util.List;

final class PlainJvmExample {
  private PlainJvmExample() {}

  static void sendWelcomeEmail() {
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
  }
}
