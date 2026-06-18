package com.opensend.models;

import com.fasterxml.jackson.annotation.JsonProperty;

public record EmailAttachment(
    String filename,
    String content,
    String path,
    @JsonProperty("content_type") String contentType,
    @JsonProperty("content_id") String contentId) {}
