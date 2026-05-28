package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;

public record SuppressionResponse(
    String id,
    String object,
    String email,
    SuppressionReason reason,
    String scope,
    @JsonProperty("source_event_id") String sourceEventId,
    @JsonProperty("source_email_id") String sourceEmailId,
    @JsonProperty("source_message_id") String sourceMessageId,
    Map<String, Object> metadata,
    @JsonProperty("suppressed_at") String suppressedAt,
    @JsonProperty("updated_at") String updatedAt) {}
