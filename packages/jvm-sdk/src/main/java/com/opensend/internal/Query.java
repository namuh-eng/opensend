package com.opensend.internal;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

public final class Query {
  private final String path;
  private final Map<String, String> params = new LinkedHashMap<>();

  public Query(String path) {
    this.path = path;
  }

  public Query add(String key, Object value) {
    if (value != null && !String.valueOf(value).isBlank()) {
      params.put(key, String.valueOf(value));
    }
    return this;
  }

  public String build() {
    if (params.isEmpty()) {
      return path;
    }
    StringBuilder query = new StringBuilder(path).append('?');
    boolean first = true;
    for (Map.Entry<String, String> entry : params.entrySet()) {
      if (!first) {
        query.append('&');
      }
      first = false;
      query
          .append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8))
          .append('=')
          .append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
    }
    return query.toString();
  }
}
