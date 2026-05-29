import com.opensend.ApiException
import com.opensend.OpenSend
import com.opensend.RequestOptions
import com.opensend.models.SendEmailRequest

fun sendWelcomeEmail() {
    val client = OpenSend.builder(System.getenv("OPENSEND_API_KEY"))
        .baseUrl(System.getenv("OPENSEND_BASE_URL") ?: OpenSend.DEFAULT_BASE_URL)
        .build()

    try {
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
    } catch (error: ApiException) {
        error.rateLimit().retryAfter().ifPresent { retryAfter ->
            println("Retry after $retryAfter seconds")
        }
        throw error
    }
}
