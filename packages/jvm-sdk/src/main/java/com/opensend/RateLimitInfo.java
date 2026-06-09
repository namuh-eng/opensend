package com.opensend;

import java.net.http.HttpHeaders;
import java.util.Optional;

/** Rate-limit headers returned with a response or API error when OpenSend provides them. */
public record RateLimitInfo(Optional<Integer> limit, Optional<Integer> remaining, Optional<String> reset, Optional<String> retryAfter) {
  public static RateLimitInfo empty() {
    return new RateLimitInfo(Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
  }

  public static RateLimitInfo fromHeaders(HttpHeaders headers) {
    return new RateLimitInfo(
        parseInt(headers.firstValue("x-ratelimit-limit")),
        parseInt(headers.firstValue("x-ratelimit-remaining")),
        headers.firstValue("x-ratelimit-reset"),
        headers.firstValue("retry-after"));
  }

  private static Optional<Integer> parseInt(Optional<String> value) {
    return value.flatMap(raw -> {
      try {
        return Optional.of(Integer.parseInt(raw));
      } catch (NumberFormatException ignored) {
        return Optional.empty();
      }
    });
  }
}
