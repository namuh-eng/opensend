package com.opensend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opensend.internal.HttpTransport;
import com.opensend.internal.Json;
import com.opensend.resources.ContactsClient;
import com.opensend.resources.DomainsClient;
import com.opensend.resources.EmailsClient;
import com.opensend.resources.SuppressionsClient;
import java.net.URI;
import java.net.http.HttpClient;
import java.util.Objects;

/** Blocking OpenSend API client for Java and Kotlin server applications. */
public final class OpenSend {
  public static final String DEFAULT_BASE_URL = "https://opensend.namuh.co";

  private final EmailsClient emails;
  private final ContactsClient contacts;
  private final DomainsClient domains;
  private final SuppressionsClient suppressions;

  private OpenSend(Builder builder) {
    HttpTransport transport = new HttpTransport(
        builder.apiKey,
        normalizeBaseUrl(builder.baseUrl),
        builder.httpClient,
        builder.objectMapper);
    this.emails = new EmailsClient(transport);
    this.contacts = new ContactsClient(transport);
    this.domains = new DomainsClient(transport);
    this.suppressions = new SuppressionsClient(transport);
  }

  public static OpenSend create(String apiKey) {
    return builder(apiKey).build();
  }

  public static Builder builder(String apiKey) {
    return new Builder(apiKey);
  }

  public EmailsClient emails() {
    return emails;
  }

  public ContactsClient contacts() {
    return contacts;
  }

  public DomainsClient domains() {
    return domains;
  }

  public SuppressionsClient suppressions() {
    return suppressions;
  }

  private static URI normalizeBaseUrl(String raw) {
    String value = raw == null ? DEFAULT_BASE_URL : raw.trim();
    if (value.isEmpty()) {
      throw new IllegalArgumentException("baseUrl must be a non-empty absolute URL when provided");
    }
    URI uri = URI.create(value);
    if (uri.getScheme() == null || uri.getHost() == null) {
      throw new IllegalArgumentException("baseUrl must be a valid absolute URL");
    }
    if (!uri.getScheme().equals("http") && !uri.getScheme().equals("https")) {
      throw new IllegalArgumentException("baseUrl must use http or https");
    }
    try {
      return new URI(uri.getScheme(), uri.getAuthority(), trimRight(uri.getPath()), null, null);
    } catch (Exception e) {
      throw new IllegalArgumentException("baseUrl must be a valid absolute URL", e);
    }
  }

  private static String trimRight(String value) {
    return value == null ? "" : value.replaceFirst("/+$", "");
  }

  public static final class Builder {
    private final String apiKey;
    private String baseUrl = DEFAULT_BASE_URL;
    private HttpClient httpClient = HttpClient.newHttpClient();
    private ObjectMapper objectMapper = Json.mapper();

    private Builder(String apiKey) {
      String trimmed = apiKey == null ? "" : apiKey.trim();
      if (trimmed.isEmpty()) {
        throw new IllegalArgumentException("apiKey is required");
      }
      this.apiKey = trimmed;
    }

    public Builder baseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
      return this;
    }

    public Builder httpClient(HttpClient httpClient) {
      this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
      return this;
    }

    public Builder objectMapper(ObjectMapper objectMapper) {
      this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
      return this;
    }

    public OpenSend build() {
      return new OpenSend(this);
    }
  }
}
