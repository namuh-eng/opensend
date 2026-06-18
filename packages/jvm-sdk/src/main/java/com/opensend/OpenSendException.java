package com.opensend;

/** Base unchecked exception for SDK transport, serialization, and API failures. */
public class OpenSendException extends RuntimeException {
  public OpenSendException(String message) {
    super(message);
  }

  public OpenSendException(String message, Throwable cause) {
    super(message, cause);
  }
}
