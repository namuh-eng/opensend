package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record UpdateDomainRequest(
    @JsonProperty("click_tracking") Boolean clickTracking,
    @JsonProperty("open_tracking") Boolean openTracking,
    @JsonProperty("tracking_subdomain") String trackingSubdomain,
    @JsonProperty("sending_enabled") Boolean sendingEnabled,
    @JsonProperty("receiving_enabled") Boolean receivingEnabled,
    String tls,
    List<DomainCapability> capabilities) {}
