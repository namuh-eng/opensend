package com.opensend.models;

import com.fasterxml.jackson.databind.JsonNode;

public record BatchEmailItemResponse(String id, ItemError error) {
  public record ItemError(String name, String code, String message, Integer statusCode, JsonNode details) {}
}
