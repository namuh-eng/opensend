package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record EmailListItem(
    String id,
    @JsonProperty("from") String from,
    List<String> to,
    String subject,
    List<String> cc,
    List<String> bcc,
    @JsonProperty("reply_to") List<String> replyTo,
    @JsonProperty("last_event") String lastEvent,
    @JsonProperty("scheduled_at") String scheduledAt,
    @JsonProperty("sent_at") String sentAt,
    @JsonProperty("created_at") String createdAt,
    @JsonProperty("provider_retry_count") Integer providerRetryCount,
    @JsonProperty("provider_last_attempted_at") String providerLastAttemptedAt,
    @JsonProperty("provider_next_retry_at") String providerNextRetryAt,
    @JsonProperty("provider_last_error") JsonNode providerLastError,
    @JsonProperty("provider_dead_lettered_at") String providerDeadLetteredAt) {}
