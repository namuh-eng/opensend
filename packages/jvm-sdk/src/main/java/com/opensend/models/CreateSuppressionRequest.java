package com.opensend.models;

public record CreateSuppressionRequest(String email, SuppressionReason reason) {}
