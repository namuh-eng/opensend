package com.opensend.models;

import java.util.Map;

public record EmailTemplateReference(String id, Map<String, Object> variables) {}
