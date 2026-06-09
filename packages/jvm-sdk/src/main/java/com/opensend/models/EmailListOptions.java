package com.opensend.models;

public record EmailListOptions(Integer limit, String after, String before, String status) {
  public static EmailListOptions empty() {
    return new EmailListOptions(null, null, null, null);
  }
}
