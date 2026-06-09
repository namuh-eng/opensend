package com.opensend;

/** Per-request options such as idempotency keys for retry-safe write operations. */
public record RequestOptions(String idempotencyKey) {
  public static RequestOptions none() {
    return new RequestOptions(null);
  }

  public static RequestOptions withIdempotencyKey(String idempotencyKey) {
    return new RequestOptions(idempotencyKey);
  }
}
