package com.opensend;

import java.net.http.HttpHeaders;

/** A successful OpenSend response plus transport metadata that may matter to callers. */
public record OpenSendResponse<T>(T data, int statusCode, HttpHeaders headers, RateLimitInfo rateLimit) {}
