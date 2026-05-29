package com.opensend;

/** Common cursor pagination options used by list endpoints. */
public record ListOptions(Integer limit, String after) {
  public static ListOptions empty() {
    return new ListOptions(null, null);
  }
}
