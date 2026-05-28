package com.opensend.models;

public record DomainRecord(String type, String name, String value, String status, String ttl, Integer priority) {}
