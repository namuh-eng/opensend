package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record ContactResponse(
    String object,
    String id,
    String email,
    @JsonProperty("first_name") String firstName,
    @JsonProperty("last_name") String lastName,
    Map<String, Object> properties,
    List<String> segments,
    @JsonProperty("created_at") String createdAt,
    @JsonProperty("updated_at") String updatedAt) {}
