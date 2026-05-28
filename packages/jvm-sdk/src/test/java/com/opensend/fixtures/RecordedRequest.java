package com.opensend.fixtures;

import com.sun.net.httpserver.Headers;

public record RecordedRequest(String method, String path, String body, Headers headers) {
  public String firstHeader(String name) {
    return headers.getFirst(name);
  }
}
