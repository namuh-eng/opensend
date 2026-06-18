package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record DomainResponse(
    String object,
    String id,
    String name,
    String status,
    String region,
    List<DomainRecord> records,
    @JsonProperty("custom_return_path") String customReturnPath,
    @JsonProperty("return_path") String returnPath,
    @JsonProperty("open_tracking") Boolean openTracking,
    @JsonProperty("click_tracking") Boolean clickTracking,
    @JsonProperty("tracking_subdomain") String trackingSubdomain,
    String tls,
    List<DomainCapability> capabilities,
    @JsonProperty("created_at") String createdAt) {}
