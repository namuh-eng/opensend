package com.opensend.resources;

import com.fasterxml.jackson.core.type.TypeReference;
import com.opensend.ListOptions;
import com.opensend.ListPage;
import com.opensend.RequestOptions;
import com.opensend.internal.HttpTransport;
import com.opensend.internal.Query;
import com.opensend.models.CreateSuppressionRequest;
import com.opensend.models.DeleteSuppressionResponse;
import com.opensend.models.SuppressionResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public final class SuppressionsClient {
  private final HttpTransport transport;

  public SuppressionsClient(HttpTransport transport) {
    this.transport = transport;
  }

  public ListPage<SuppressionResponse> list() {
    return list(ListOptions.empty());
  }

  public ListPage<SuppressionResponse> list(ListOptions options) {
    ListOptions safe = options == null ? ListOptions.empty() : options;
    String path = new Query("/api/suppressions")
        .add("limit", safe.limit())
        .add("after", safe.after())
        .build();
    return transport.json("GET", path, null, RequestOptions.none(), new TypeReference<ListPage<SuppressionResponse>>() {});
  }

  public SuppressionResponse get(String email) {
    return transport.json("GET", "/api/suppressions/" + escape(email), null, RequestOptions.none(), new TypeReference<SuppressionResponse>() {});
  }

  public SuppressionResponse create(CreateSuppressionRequest request) {
    return create(request, RequestOptions.none());
  }

  public SuppressionResponse create(CreateSuppressionRequest request, RequestOptions options) {
    return transport.json("POST", "/api/suppressions", request, options, new TypeReference<SuppressionResponse>() {});
  }

  public DeleteSuppressionResponse delete(String email) {
    return transport.json("DELETE", "/api/suppressions/" + escape(email), null, RequestOptions.none(), new TypeReference<DeleteSuppressionResponse>() {});
  }

  private static String escape(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
