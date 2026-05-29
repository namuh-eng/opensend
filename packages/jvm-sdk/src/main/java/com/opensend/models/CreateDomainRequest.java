package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record CreateDomainRequest(
    String name,
    String region,
    @JsonProperty("custom_return_path") String customReturnPath,
    @JsonProperty("open_tracking") Boolean openTracking,
    @JsonProperty("click_tracking") Boolean clickTracking,
    @JsonProperty("tracking_subdomain") String trackingSubdomain,
    String tls,
    List<DomainCapability> capabilities) {}
