package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DomainListItem(
    String id,
    String name,
    String status,
    String region,
    List<DomainCapability> capabilities,
    @JsonProperty("created_at") String createdAt) {}
