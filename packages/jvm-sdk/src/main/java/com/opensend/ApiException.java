package com.opensend;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpHeaders;

/** Non-2xx response returned by OpenSend. */
public class ApiException extends OpenSendException {
  private final int statusCode;
  private final String body;
  private final String name;
  private final String code;
  private final JsonNode details;
  private final HttpHeaders headers;
  private final RateLimitInfo rateLimit;

  public ApiException(
      int statusCode,
      String body,
      String message,
      String name,
      String code,
      JsonNode details,
      HttpHeaders headers,
      RateLimitInfo rateLimit) {
    super("opensend: API request failed with status " + statusCode + ": " + message);
    this.statusCode = statusCode;
    this.body = body;
    this.name = name;
    this.code = code;
    this.details = details;
    this.headers = headers;
    this.rateLimit = rateLimit;
  }

  public int statusCode() {
    return statusCode;
  }

  public String body() {
    return body;
  }

  public String apiMessage() {
    String prefix = "opensend: API request failed with status " + statusCode + ": ";
    return getMessage().startsWith(prefix) ? getMessage().substring(prefix.length()) : getMessage();
  }

  public String name() {
    return name;
  }

  public String code() {
    return code;
  }

  public JsonNode details() {
    return details;
  }

  public HttpHeaders headers() {
    return headers;
  }

  public RateLimitInfo rateLimit() {
    return rateLimit;
  }
}
