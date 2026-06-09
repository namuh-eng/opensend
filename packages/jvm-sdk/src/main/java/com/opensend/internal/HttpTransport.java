package com.opensend.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opensend.ApiException;
import com.opensend.OpenSendException;
import com.opensend.OpenSendResponse;
import com.opensend.RateLimitInfo;
import com.opensend.RequestOptions;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

public final class HttpTransport {
  public static final String USER_AGENT = "opensend-jvm/0.1.0";

  private final String apiKey;
  private final URI baseUri;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;

  public HttpTransport(String apiKey, URI baseUri, HttpClient httpClient, ObjectMapper objectMapper) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
  }

  public <T> T json(String method, String path, Object body, RequestOptions options, TypeReference<T> type) {
    return response(method, path, body, options, type).data();
  }

  public <T> OpenSendResponse<T> response(String method, String path, Object body, RequestOptions options, TypeReference<T> type) {
    HttpRequest request = buildRequest(method, path, body, options == null ? RequestOptions.none() : options);
    HttpResponse<String> response;
    try {
      response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (IOException e) {
      throw new OpenSendException("opensend: execute request", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new OpenSendException("opensend: request interrupted", e);
    }

    RateLimitInfo rateLimit = RateLimitInfo.fromHeaders(response.headers());
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw parseApiError(response.statusCode(), response.body(), response.headers(), rateLimit);
    }

    T data = null;
    if (type != null && response.body() != null && !response.body().isBlank()) {
      try {
        data = objectMapper.readValue(response.body(), type);
      } catch (JsonProcessingException e) {
        throw new OpenSendException("opensend: decode response", e);
      }
    }
    return new OpenSendResponse<>(data, response.statusCode(), response.headers(), rateLimit);
  }

  private HttpRequest buildRequest(String method, String path, Object body, RequestOptions options) {
    HttpRequest.BodyPublisher publisher = HttpRequest.BodyPublishers.noBody();
    if (body != null) {
      try {
        publisher = HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body));
      } catch (JsonProcessingException e) {
        throw new OpenSendException("opensend: encode request body", e);
      }
    }

    HttpRequest.Builder builder = HttpRequest.newBuilder(resolve(path))
        .timeout(Duration.ofSeconds(60))
        .header("Authorization", "Bearer " + apiKey)
        .header("Accept", "application/json")
        .header("User-Agent", USER_AGENT)
        .method(method.toUpperCase(Locale.ROOT), publisher);
    if (body != null) {
      builder.header("Content-Type", "application/json");
    }
    if (options.idempotencyKey() != null && !options.idempotencyKey().isBlank()) {
      builder.header("Idempotency-Key", options.idempotencyKey());
    }
    return builder.build();
  }

  private URI resolve(String path) {
    String basePath = trimRight(baseUri.getRawPath());
    String requestPath = "/" + trimLeft(path == null ? "" : path);
    String combinedPath = basePath.isEmpty() ? requestPath : basePath + requestPath;
    String query = extractQuery(path);
    String uri = baseUri.getScheme() + "://" + baseUri.getRawAuthority() + combinedPath + (query == null ? "" : "?" + query);
    try {
      return URI.create(uri);
    } catch (IllegalArgumentException e) {
      throw new OpenSendException("opensend: build request URI", e);
    }
  }

  private static String trimLeft(String value) {
    String withoutQuery = value.contains("?") ? value.substring(0, value.indexOf('?')) : value;
    return withoutQuery.replaceFirst("^/+", "");
  }

  private static String trimRight(String value) {
    return value == null ? "" : value.replaceFirst("/+$", "");
  }

  private static String extractQuery(String path) {
    if (path == null) {
      return null;
    }
    int index = path.indexOf('?');
    return index >= 0 ? path.substring(index + 1) : null;
  }

  private ApiException parseApiError(int statusCode, String body, HttpHeaders headers, RateLimitInfo rateLimit) {
    String message = defaultStatusMessage(statusCode);
    String name = null;
    String code = null;
    JsonNode details = null;

    if (body != null && !body.isBlank()) {
      try {
        JsonNode root = objectMapper.readTree(body);
        if (root.hasNonNull("message")) {
          message = root.get("message").asText();
        } else if (root.hasNonNull("error")) {
          message = root.get("error").asText();
        }
        if (root.hasNonNull("name")) {
          name = root.get("name").asText();
        }
        if (root.hasNonNull("code")) {
          code = root.get("code").asText();
        }
        if (root.has("details") && !root.get("details").isNull()) {
          details = root.get("details");
        }
      } catch (JsonProcessingException ignored) {
        // Keep the status text and raw body for unexpected non-JSON errors.
      }
    }

    return new ApiException(statusCode, body == null ? "" : body, message, name, code, details, headers, rateLimit);
  }

  private static String defaultStatusMessage(int statusCode) {
    return switch (statusCode) {
      case 400 -> "Bad Request";
      case 401 -> "Unauthorized";
      case 403 -> "Forbidden";
      case 404 -> "Not Found";
      case 409 -> "Conflict";
      case 422 -> "Unprocessable Entity";
      case 429 -> "Too Many Requests";
      default -> "Request failed";
    };
  }
}
