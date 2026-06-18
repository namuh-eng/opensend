package com.opensend;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/** Cursor-paginated OpenSend collection response. */
public record ListPage<T>(
    String object,
    List<T> data,
    @JsonProperty("has_more") boolean hasMore) {}
